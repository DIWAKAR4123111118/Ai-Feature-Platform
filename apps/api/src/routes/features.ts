import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '../logger';
import { fetchGitHubRepoMetadata } from '../services/github';
import { calculateHealthScore } from '../services/healthScore';
import { classifyLicense } from '../services/licenseclassifier';

const router = Router();
const prisma = new PrismaClient();

// POST /features - Create a feature
router.post('/', async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    const feature = await prisma.features.create({
      data: {
        name,
        description,
        status: 'discovered',
        approved: false,
      },
    });

    logger.info({ featureId: feature.id }, 'Feature created');
    res.status(201).json(feature);
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return res
        .status(409)
        .json({ error: 'Feature with this name already exists' });
    }
    logger.error({ error }, 'Failed to create feature');
    res.status(500).json({
      error: 'Failed to create feature',
      details: error?.message || String(error),
    });
  }
});

// GET /features - List all features
router.get('/', async (req, res) => {
  try {
    const features = await prisma.features.findMany({
      include: {
        repositories: true,
      },
    });

    res.json(features);
  } catch (error: any) {
    logger.error({ error }, 'Failed to list features');
    res.status(500).json({
      error: 'Failed to list features',
      details: error?.message || String(error),
    });
  }
});

// POST /features/:id/repos - Attach a GitHub repo with license classification
router.post('/:id/repos', async (req, res) => {
  try {
    const { id } = req.params;
    const { githubUrl, owner, repo } = req.body;

    if (!githubGithubUrl || !owner || !repo) {
      return res.status(400).json({
        error: 'githubUrl, owner, and repo are required',
      });
    }

    const featureId = Number(id);
    const feature = await prisma.features.findUnique({
      where: { id: featureId },
    });

    if (!feature) {
      return res.status(404).json({ error: 'Feature not found' });
    }

    // Fetch GitHub metadata
    const metadata = await fetchGitHubRepoMetadata(owner, repo);

    let stars: number | null = null;
    let licenseSpdx: string | null = null;
    let lastCommitAt: Date | null = null;
    let archived = false;

    if (metadata) {
      stars = metadata.stargazers_count;
      licenseSpdx = metadata.license?.spdx_id || null;
      lastCommitAt = new Date(metadata.pushed_at);
      archived = metadata.archived;
    }

    // Health score
    let healthScore: number | null = null;
    if (stars !== null || lastCommitAt !== null || licenseSpdx !== null) {
      healthScore = calculateHealthScore({
        stars,
        lastCommitAt,
        archived,
        licenseSpdx,
      });
    }

    // License classification
    const classification = classifyLicense(licenseSpdx);

    // Upsert repository record with license info
    const repoRecord = await prisma.repositories.upsert({
      where: {
        github_url: githubUrl,
      },
      update: {
        name: repo,
        description: metadata?.description ?? null,
        stars: stars ?? undefined,
        license_spdx: licenseSpdx ?? undefined,
        license_risk_tier: classification.tier,
        license_accepted: classification.tier === 'safe',
        status: 'pending',
      },
      create: {
        github_url: githubUrl,
        name: repo,
        description: metadata?.description ?? null,
        stars: stars ?? 0,
        language: null,
        license_spdx: licenseSpdx ?? undefined,
        license_risk_tier: classification.tier,
        license_accepted: classification.tier === 'safe',
        status: 'pending',
      },
    });

    // Link feature -> repository via repo_id
    const updatedFeature = await prisma.features.update({
      where: { id: featureId },
      data: {
        repo_id: repoRecord.id,
        updated_at: new Date(),
      },
    });

    logger.info(
      {
        featureId,
        repositoryId: repoRecord.id,
        stars,
        archived,
        healthScore,
        licenseSpdx,
        tier: classification.tier,
      },
      'Repo attached to feature with metadata and license classification',
    );

    res.status(201).json({
      feature: updatedFeature,
      repository: repoRecord,
      licenseClassification: classification,
    });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return res.status(409).json({ error: 'This repo is already attached' });
    }
    logger.error({ error }, 'Failed to attach repo');
    res.status(500).json({
      error: 'Failed to attach repo',
      details: error?.message || String(error),
    });
  }
});

// GET /features/:featureId/repos/:repoId/license - View license details
router.get('/:featureId/repos/:repoId/license', async (req, res) => {
  try {
    const { featureId, repoId } = req.params;

    const feature = await prisma.features.findUnique({
      where: { id: Number(featureId) },
    });

    if (!feature) {
      return res.status(404).json({ error: 'Feature not found' });
    }

    const repo = await prisma.repositories.findFirst({
      where: {
        id: Number(repoId),
      },
    });

    if (!repo) {
      return res
        .status(404)
        .json({ error: 'Repository not found for this feature' });
    }

    return res.json({
      licenseSpdx: repo.license_spdx,
      licenseRiskTier: repo.license_risk_tier,
      licenseText: repo.license_text || null,
      licenseAccepted: repo.license_accepted || false,
    });
  } catch (error: any) {
    logger.error({ error }, 'Failed to fetch license info');
    res.status(500).json({
      error: 'Failed to fetch license info',
      details: error?.message || String(error),
    });
  }
});

// POST /features/:featureId/repos/:repoId/accept-license - Accept risky license
router.post('/:featureId/repos/:repoId/accept-license', async (req, res) => {
  try {
    const { featureId, repoId } = req.params;

    const feature = await prisma.features.findUnique({
      where: { id: Number(featureId) },
    });

    if (!feature) {
      return res.status(404).json({ error: 'Feature not found' });
    }

    const repo = await prisma.repositories.findFirst({
      where: {
        id: Number(repoId),
      },
    });

    if (!repo) {
      return res
        .status(404)
        .json({ error: 'Repository not found for this feature' });
    }

    if (repo.license_risk_tier !== 'risky') {
      return res.status(400).json({
        error: 'License acceptance only required for risky licenses',
      });
    }

    const updatedRepo = await prisma.repositories.update({
      where: { id: Number(repoId) },
      data: {
        license_accepted: true,
        license_accepted_by: 'system', // TODO: wire to auth user
        license_accepted_at: new Date(),
      },
    });

    logger.info(
      {
        featureId,
        repositoryId: repo.id,
        licenseSpdx: repo.license_spdx,
        licenseRiskTier: repo.license_risk_tier,
      },
      'License accepted for repository',
    );

    return res.json({
      success: true,
      message: 'License accepted',
      repository: updatedRepo,
    });
  } catch (error: any) {
    logger.error({ error }, 'Failed to accept license');
    res.status(500).json({
      error: 'Failed to accept license',
      details: error?.message || String(error),
    });
  }
});

export default router;