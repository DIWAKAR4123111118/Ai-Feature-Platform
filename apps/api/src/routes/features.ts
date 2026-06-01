import { Router } from 'express';
import { prisma } from '../prismaClient';
import { logger } from '../logger';
import { fetchGitHubRepoMetadata } from '../services/github';
import { calculateHealthScore } from '../services/healthScore';
import { classifyLicense } from '../services/licenseClassifier';
import {
  approveFeature,
  rejectFeature,
  FeatureApprovalError,
} from '../services/featureApprovalService';

const router = Router();

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
router.get('/', async (_req, res) => {
  try {
    const features = await prisma.features.findMany();
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

    if (!githubUrl || !owner || !repo) {
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

    let healthScore: number | null = null;
    if (stars !== null || lastCommitAt !== null || licenseSpdx !== null) {
      healthScore = calculateHealthScore({
        stars,
        lastCommitAt,
        archived,
        licenseSpdx,
      });
    }

    const classification = classifyLicense(licenseSpdx);

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

    await prisma.feature_repositories.upsert({
      where: {
        feature_id_repository_id: {
          feature_id: featureId,
          repository_id: repoRecord.id,
        },
      },
      update: {
        licenseRiskTier: classification.tier,
        licenseAccepted: classification.tier === 'safe',
        licenseAcceptedBy: classification.tier === 'safe' ? 'system' : null,
        licenseAcceptedAt: classification.tier === 'safe' ? new Date() : null,
        licenseText: repoRecord.license_text || null,
      },
      create: {
        feature_id: featureId,
        repository_id: repoRecord.id,
        licenseRiskTier: classification.tier,
        licenseAccepted: classification.tier === 'safe',
        licenseAcceptedBy: classification.tier === 'safe' ? 'system' : null,
        licenseAcceptedAt: classification.tier === 'safe' ? new Date() : null,
        licenseText: repoRecord.license_text || null,
      },
    });

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
      'Repo attached to feature with metadata and license classification (no local checkout)',
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

    const fr = await prisma.feature_repositories.findUnique({
      where: {
        feature_id_repository_id: {
          feature_id: Number(featureId),
          repository_id: Number(repoId),
        },
      },
      include: { repository: true },
    });

    if (!fr || !fr.repository) {
      return res.status(404).json({
        error: 'Repository not attached to this feature',
      });
    }

    return res.json({
      licenseSpdx: fr.repository.license_spdx,
      licenseRiskTier: fr.licenseRiskTier,
      licenseText: fr.licenseText || fr.repository.license_text || null,
      licenseAccepted: fr.licenseAccepted,
      licenseAcceptedBy: fr.licenseAcceptedBy,
      licenseAcceptedAt: fr.licenseAcceptedAt,
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

    const fr = await prisma.feature_repositories.findUnique({
      where: {
        feature_id_repository_id: {
          feature_id: Number(featureId),
          repository_id: Number(repoId),
        },
      },
      include: { repository: true },
    });

    if (!fr || !fr.repository) {
      return res.status(404).json({
        error: 'Repository not attached to this feature',
      });
    }

    const repo = fr.repository;

    if (
      fr.licenseRiskTier === 'blocked' ||
      repo.license_risk_tier === 'blocked'
    ) {
      return res.status(400).json({
        error: 'Blocked license cannot be accepted',
      });
    }

    const effectiveTier = fr.licenseRiskTier || repo.license_risk_tier;

    if (effectiveTier !== 'risky') {
      return res.status(400).json({
        error: 'License acceptance only required for risky licenses',
      });
    }

    const updatedFr = await prisma.feature_repositories.update({
      where: {
        feature_id_repository_id: {
          feature_id: Number(featureId),
          repository_id: Number(repoId),
        },
      },
      data: {
        licenseAccepted: true,
        licenseAcceptedBy: 'system',
        licenseAcceptedAt: new Date(),
      },
    });

    logger.info(
      {
        featureId,
        repositoryId: repo.id,
        licenseSpdx: repo.license_spdx,
        licenseRiskTier: updatedFr.licenseRiskTier,
      },
      'License accepted for repository for this feature',
    );

    return res.json({
      success: true,
      message: 'License accepted',
      license: {
        licenseSpdx: repo.license_spdx,
        licenseRiskTier: updatedFr.licenseRiskTier,
        licenseAccepted: updatedFr.licenseAccepted,
        licenseAcceptedBy: updatedFr.licenseAcceptedBy,
        licenseAcceptedAt: updatedFr.licenseAcceptedAt,
      },
    });
  } catch (error: any) {
    logger.error({ error }, 'Failed to accept license');
    res.status(500).json({
      error: 'Failed to accept license',
      details: error?.message || String(error),
    });
  }
});

// POST /features/:id/approve - Run gates and approve feature
router.post('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const featureId = Number(id);

    const approvedBy = 'system';

    const updatedFeature = await approveFeature(featureId, approvedBy);

    return res.json({
      success: true,
      message: 'Feature approved',
      feature: updatedFeature,
    });
  } catch (error: any) {
    if (error instanceof FeatureApprovalError) {
      return res.status(400).json({ error: error.message });
    }
    logger.error({ error }, 'Failed to approve feature');
    return res.status(500).json({
      error: 'Failed to approve feature',
      details: error?.message || String(error),
    });
  }
});

// POST /features/:id/reject - Mark feature as rejected
router.post('/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const featureId = Number(id);
    const { reason } = req.body || {};

    const updatedFeature = await rejectFeature(featureId, reason ?? null);

    return res.json({
      success: true,
      message: 'Feature rejected',
      feature: updatedFeature,
    });
  } catch (error: any) {
    if (error instanceof FeatureApprovalError) {
      return res.status(400).json({ error: error.message });
    }
    logger.error({ error }, 'Failed to reject feature');
    return res.status(500).json({
      error: 'Failed to reject feature',
      details: error?.message || String(error),
    });
  }
});

export default router;
