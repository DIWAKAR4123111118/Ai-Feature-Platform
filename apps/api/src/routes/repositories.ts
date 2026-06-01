// apps/api/src/routes/repositories.ts
import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { logger } from '../logger';
import { authMiddleware } from '../middleware/auth';
import { fetchGitHubRepoMetadata } from '../services/github';
import {
  classifyLicense,
  getLicenseWarning,
} from '../services/licenseClassifier';
import { executeAdapter } from '../services/adapterExecutor';
import { computeAndStoreEslintSummary } from '../services/eslintSummary';
import {
  assertRepositoryLicenseAllowsExecution,
  LicenseExecutionError,
} from '../services/licenseGuard';

const router = Router();

// Get all repositories
router.get('/', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const repositories = await prisma.repositories.findMany({
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        github_url: true,
        name: true,
        description: true,
        stars: true,
        license_spdx: true,
        license_risk_tier: true,
        license_accepted: true,
        security_score: true,
        quality_score: true,
        status: true,
        eslint_status: true,
        eslint_errors_count: true,
        created_at: true,
      },
    });

    return res.json({ repositories });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch repositories');
    return res.status(500).json({ error: 'Failed to fetch repositories' });
  }
});

// Create repository
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { github_url, name, description } = req.body;

    if (!github_url || !name) {
      return res
        .status(400)
        .json({ error: 'github_url and name are required' });
    }

    const urlMatch = github_url.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!urlMatch) {
      return res
        .status(400)
        .json({ error: 'Invalid GitHub URL format' });
    }

    const [, owner, repo] = urlMatch;

    let stars = 0;
    let licenseSpdx: string | null = null;
    let licenseText: string | null = null;

    try {
      const metadata = await fetchGitHubRepoMetadata(owner, repo);
      if (metadata) {
        stars = metadata.stargazers_count || 0;
        licenseSpdx = metadata.license?.spdx_id || null;

        if (licenseSpdx) {
          const licenseResponse = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/license`,
            {
              headers: {
                Accept: 'application/vnd.github.v3+json',
                'User-Agent': 'AI-Feature-Platform',
              },
            },
          );

          if (licenseResponse.ok) {
            const licenseData = await licenseResponse.json();
            if (licenseData?.content) {
              licenseText = Buffer.from(
                licenseData.content,
                'base64',
              ).toString('utf-8');
            }
          }
        }
      }
    } catch (err) {
      logger.warn({ err, github_url }, 'Failed to fetch GitHub metadata');
    }

    const licenseClassification = classifyLicense(licenseSpdx);

    if (licenseClassification.tier === 'blocked') {
      return res.status(400).json({
        error: 'Repository license is not approved',
        license: licenseSpdx || 'NONE',
        reason: licenseClassification.reason,
        requiresManualReview: true,
      });
    }

    const repository = await prisma.repositories.create({
      data: {
        github_url,
        name,
        description,
        stars,
        license_spdx: licenseSpdx,
        license_text: licenseText,
        license_risk_tier: licenseClassification.tier,
        license_accepted: licenseClassification.tier === 'safe',
        status: 'pending',
      },
    });

    const response: any = {
      repository,
      licenseClassification,
    };

    if (licenseClassification.tier === 'risky') {
      response.licenseWarning = getLicenseWarning(licenseSpdx!);
      response.requiresAcceptance = true;
    }

    logger.info(
      {
        repoId: repository.id,
        licenseSpdx,
        licenseRiskTier: licenseClassification.tier,
      },
      'Repository created with license classification',
    );

    return res.status(201).json(response);
  } catch (error: any) {
    logger.error({ error }, 'Failed to create repository');
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Repository URL already exists' });
    }
    return res.status(500).json({ error: 'Failed to create repository' });
  }
});

// Accept risky license
router.post(
  '/:id/accept-license',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const idStr = Array.isArray(id) ? id[0] : id;

      const userId = (req as any).user?.userId;
      const { acknowledgeRisks } = req.body;

      if (!acknowledgeRisks) {
        return res.status(400).json({
          error:
            'You must acknowledge license risks by setting acknowledgeRisks: true',
        });
      }

      const repoId = Number(idStr);
      if (Number.isNaN(repoId)) {
        return res.status(400).json({ error: 'Invalid repository id' });
      }

      const repo = await prisma.repositories.findUnique({
        where: { id: repoId },
      });

      if (!repo) {
        return res.status(404).json({ error: 'Repository not found' });
      }

      if (repo.license_risk_tier !== 'risky') {
        return res.status(400).json({
          error: 'This repository does not require license acceptance',
          tier: repo.license_risk_tier,
        });
      }

      const updatedRepo = await prisma.repositories.update({
        where: { id: repoId },
        data: {
          license_accepted: true,
          license_accepted_by: userId?.toString() ?? null,
          license_accepted_at: new Date(),
        },
      });

      logger.info(
        { repoId: repoId, userId, license: repo.license_spdx },
        'Risky license accepted',
      );

      return res.json({
        message: 'License risk accepted',
        repository: updatedRepo,
        disclaimer:
          'You acknowledge responsibility for compliance with this license.',
      });
    } catch (error) {
      logger.error({ error }, 'Failed to accept license');
      return res.status(500).json({ error: 'Failed to accept license' });
    }
  },
);

// Get repository license
router.get(
  '/:id/license',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const idStr = Array.isArray(id) ? id[0] : id;

      const repoId = Number(idStr);
      if (Number.isNaN(repoId)) {
        return res.status(400).json({ error: 'Invalid repository id' });
      }

      const repo = await prisma.repositories.findUnique({
        where: { id: repoId },
        select: {
          license_spdx: true,
          license_text: true,
          license_risk_tier: true,
          github_url: true,
        },
      });

      if (!repo) {
        return res.status(404).json({ error: 'Repository not found' });
      }

      return res.json({
        license: repo.license_spdx,
        riskTier: repo.license_risk_tier,
        fullText: repo.license_text,
        sourceUrl: `${repo.github_url}/blob/main/LICENSE`,
      });
    } catch (error) {
      logger.error({ error }, 'Failed to fetch license');
      return res.status(500).json({ error: 'Failed to fetch license' });
    }
  },
);

// Get ESLint summary
router.get(
  '/:id/eslint-summary',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const idStr = Array.isArray(id) ? id[0] : id;

      const repoId = Number(idStr);
      if (Number.isNaN(repoId)) {
        return res.status(400).json({ error: 'Invalid repository id' });
      }

      const repo = await prisma.repositories.findUnique({
        where: { id: repoId },
        select: {
          id: true,
          eslint_status: true,
          eslint_errors_count: true,
        },
      });

      if (!repo) {
        return res.status(404).json({ error: 'Repository not found' });
      }

      return res.json({
        repositoryId: repo.id,
        eslintStatus: repo.eslint_status || 'unknown',
        eslintErrorsCount: repo.eslint_errors_count ?? 0,
      });
    } catch (error) {
      logger.error({ error }, 'Failed to fetch ESLint summary');
      return res.status(500).json({ error: 'Failed to fetch ESLint summary' });
    }
  },
);

// ESLint scan trigger
router.post(
  '/:id/eslint-scan',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const idStr = Array.isArray(id) ? id[0] : id;
      const repositoryId = Number(idStr);

      if (Number.isNaN(repositoryId)) {
        return res.status(400).json({ error: 'Invalid repository id' });
      }

      const repo = await prisma.repositories.findUnique({
        where: { id: repositoryId },
        select: { id: true },
      });

      if (!repo) {
        return res.status(404).json({ error: 'Repository not found' });
      }

      await assertRepositoryLicenseAllowsExecution(repositoryId);

      const adapterResult = await executeAdapter({
        repositoryId,
        adapterName: 'eslint',
        filePath: null,
        input: {},
      });

      const summary = await computeAndStoreEslintSummary(repositoryId);

      return res.json({
        repositoryId: summary.repositoryId.toString(),
        eslintStatus: summary.eslintStatus,
        eslintErrorsCount: summary.totalLintErrors,
        adapterExecutionId: adapterResult.id,
      });
    } catch (error) {
      if (error instanceof LicenseExecutionError) {
        return res.status(400).json({ error: error.message });
      }

      logger.error({ error }, 'Failed to run ESLint scan');
      return res.status(500).json({ error: 'Failed to run ESLint scan' });
    }
  },
);

// Get single repository
router.get(
  '/:id',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const idStr = Array.isArray(id) ? id[0] : id;

      const repoId = Number(idStr);
      if (Number.isNaN(repoId)) {
        return res.status(400).json({ error: 'Invalid repository id' });
      }

      const repository = await prisma.repositories.findUnique({
        where: { id: repoId },
      });

      if (!repository) {
        return res.status(404).json({ error: 'Repository not found' });
      }

      return res.json({ repository });
    } catch (error) {
      logger.error({ error }, 'Failed to fetch repository');
      return res.status(500).json({ error: 'Failed to fetch repository' });
    }
  },
);

export default router;
