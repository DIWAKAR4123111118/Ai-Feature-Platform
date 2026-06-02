// apps/api/src/routes/capabilitiesExecute.ts
import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { apiKeyAuth } from '../middleware/apiKeyAuth';
import {
  assertFeatureRepositoryLicenseAllowsExecution,
  LicenseExecutionError,
} from '../services/licenseGuard';
import { enqueueAdapterJob } from '../services/adapterJobQueue';

const router = Router();

// POST /capabilities/:slug/execute
router.post('/:slug/execute', apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { input } = req.body || {};

    if (!input || typeof input !== 'object') {
      return res.status(400).json({ error: 'Missing or invalid input' });
    }

    const capability = await prisma.capabilities.findUnique({
      where: { slug },
      include: {
        feature: true,
        repository: true,
      },
    });

    if (!capability) {
      return res.status(404).json({ error: 'Capability not found' });
    }

    if (capability.license_tier === 'blocked' || capability.license_tier === 'unclassified') {
      return res.status(403).json({ error: 'Capability is not available due to license policy' });
    }

    const featureId = capability.feature_id;
    const repoId = capability.repository_id;
    const projectId = req.projectId ?? null;

    await assertFeatureRepositoryLicenseAllowsExecution(featureId, repoId, projectId);

    const job = await enqueueAdapterJob({
      adapterName: capability.adapter_name,
      repositoryId: repoId,
      featureId,
      projectId,
      tenantId: req.tenantId ?? null,
      input,
    });

    return res.status(202).json({
      executionId: job.executionId,
      jobId: job.jobId,
      status: 'queued',
    });
  } catch (err: any) {
    if (err instanceof LicenseExecutionError) {
      return res.status(400).json({ error: err.message });
    }

    return res.status(500).json({
      error: 'Capability execution failed',
      details: err?.message || String(err),
    });
  }
});

export default router;