// apps/api/src/routes/capabilityExecute.ts
import { Router } from 'express';
import { prisma } from '../prismaClient';
import { apiKeyAuth } from '../middleware/apiKeyAuth';
import { capabilityRateLimiter } from '../middleware/rateLimit';
import { requireFeatureApproved } from '../middleware/requireFeatureApproved';
import {
  assertFeatureRepositoryLicenseAllowsExecution,
  LicenseExecutionError,
} from '../services/licenseGuard';
import { enqueueAdapterJob } from '../services/adapterJobQueue';

/**
 * Legacy / internal capability executor:
 * POST /internal/capabilities/:featureId/execute
 * - Uses featureId instead of slug
 * - Goes through enqueueAdapterJob (adapter_executions + queue)
 */
const router = Router();

router.post(
  '/capabilities/:featureId/execute',
  apiKeyAuth,
  capabilityRateLimiter,
  requireFeatureApproved('ESLint'),
  async (req, res) => {
    console.log('CAPABILITY_ROUTE_HIT', req.method, req.path);

    try {
      const { featureId } = req.params;
      const featureIdNum = Number(featureId);

      if (Number.isNaN(featureIdNum) || featureIdNum <= 0) {
        return res.status(400).json({ error: 'Invalid featureId' });
      }

      if (!req.projectId) {
        return res
          .status(400)
          .json({ error: 'No project bound to API key' });
      }

      const feature = await prisma.features.findUnique({
        where: { id: featureIdNum },
        include: { repositories: true },
      });

      if (!feature) {
        return res.status(404).json({ error: 'Feature not found' });
      }

      if (!feature.repo_id || !feature.repositories) {
        return res
          .status(404)
          .json({ error: 'Feature repository not found' });
      }

      const repositoryId = feature.repo_id;

      await assertFeatureRepositoryLicenseAllowsExecution(
        featureIdNum,
        repositoryId,
        req.projectId,
      );

      const adapterName = 'eslint';
      const { input } = req.body ?? {};

      const job = await enqueueAdapterJob({
        adapterName,
        repositoryId,
        featureId: featureIdNum,
        projectId: req.projectId,
        tenantId: req.tenantId ?? null,
        input,
      });

      return res.json({
        executionId: job.executionId,
        jobId: job.jobId,
        status: 'queued',
      });
    } catch (error: any) {
      if (error instanceof LicenseExecutionError) {
        return res.status(400).json({ error: error.message });
      }

      return res.status(500).json({
        error: 'Failed to enqueue capability execution',
        details: error?.message || String(error),
      });
    }
  },
);

export default router;