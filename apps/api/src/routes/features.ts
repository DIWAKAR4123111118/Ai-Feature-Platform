import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '../logger';
import { fetchGitHubRepoMetadata } from '../services/github';
import { calculateHealthScore } from '../services/healthScore';

const router = Router();
const prisma = new PrismaClient();

// POST /features - Create a feature
router.post('/', async (req, res) => {
  try {
    const { name, slug, description } = req.body;

    if (!name || !slug) {
      return res.status(400).json({ error: 'name and slug are required' });
    }

    const feature = await prisma.feature.create({
      data: { name, slug, description },
    });

    logger.info({ featureId: feature.id }, 'Feature created');
    res.status(201).json(feature);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Feature with this name or slug already exists' });
    }
    logger.error({ error }, 'Failed to create feature');
    res.status(500).json({ error: 'Failed to create feature' });
  }
});

// GET /features - List all features
router.get('/', async (req, res) => {
  try {
    const features = await prisma.feature.findMany({
      include: {
        repos: true,
        versions: true,
      },
    });

    res.json(features);
  } catch (error) {
    logger.error({ error }, 'Failed to list features');
    res.status(500).json({ error: 'Failed to list features' });
  }
});

// POST /features/:id/repos - Attach a GitHub repo
router.post('/:id/repos', async (req, res) => {
  try {
    const { id } = req.params;
    const { provider, owner, repo, repoUrl } = req.body;

    if (!provider || !owner || !repo || !repoUrl) {
      return res.status(400).json({ 
        error: 'provider, owner, repo, and repoUrl are required' 
      });
    }

    // Fetch GitHub metadata
    let stars = null;
    let licenseSpdx = null;
    let lastCommitAt = null;
    let archived = false;

    if (provider === 'github') {
      const metadata = await fetchGitHubRepoMetadata(owner, repo);
      
      if (metadata) {
        stars = metadata.stargazers_count;
        licenseSpdx = metadata.license?.spdx_id || null;
        lastCommitAt = new Date(metadata.pushed_at);
        archived = metadata.archived;
      }
    }

    // Calculate health score
    let healthScore = null;
    if (stars !== null || lastCommitAt !== null || licenseSpdx !== null) {
      healthScore = calculateHealthScore({ stars, lastCommitAt, archived, licenseSpdx });
    }

    const featureRepo = await prisma.featureRepo.create({
      data: {
        featureId: id,
        provider,
        owner,
        repo,
        repoUrl,
        stars,
        licenseSpdx,
        lastCommitAt,
        archived,
        healthScore,
      },
    });

    logger.info({ featureRepoId: featureRepo.id, stars, archived, healthScore }, 'Repo attached with metadata');
    res.status(201).json(featureRepo);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'This repo is already attached' });
    }
    logger.error({ error }, 'Failed to attach repo');
    res.status(500).json({ error: 'Failed to attach repo' });
  }
});

// POST /features/:id/versions - Create a version
router.post('/:id/versions', async (req, res) => {
  try {
    const { id } = req.params;
    const { versionLabel, sourceCommit, adapterVersion, approvalStatus } = req.body;

    if (!versionLabel || !sourceCommit || !adapterVersion) {
      return res.status(400).json({ 
        error: 'versionLabel, sourceCommit, and adapterVersion are required' 
      });
    }

    const featureVersion = await prisma.featureVersion.create({
      data: {
        featureId: id,
        versionLabel,
        sourceCommit,
        adapterVersion,
        approvalStatus: approvalStatus || 'pending',
      },
    });

    logger.info({ versionId: featureVersion.id, versionLabel }, 'Version created');
    res.status(201).json(featureVersion);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Version already exists for this feature' });
    }
    logger.error({ error }, 'Failed to create version');
    res.status(500).json({ error: 'Failed to create version' });
  }
});

// PATCH /features/:id/versions/:versionId - Update version approval
router.patch('/:id/versions/:versionId', async (req, res) => {
  try {
    const { versionId } = req.params;
    const { approvalStatus, approvedBy } = req.body;

    const updateData: any = {};
    if (approvalStatus) updateData.approvalStatus = approvalStatus;
    if (approvedBy) updateData.approvedBy = approvedBy;
    if (approvalStatus === 'approved') updateData.approvedAt = new Date();

    const featureVersion = await prisma.featureVersion.update({
      where: { id: versionId },
      data: updateData,
    });

    logger.info({ versionId, approvalStatus }, 'Version updated');
    res.json(featureVersion);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Version not found' });
    }
    logger.error({ error }, 'Failed to update version');
    res.status(500).json({ error: 'Failed to update version' });
  }
});

export default router;