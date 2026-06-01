// apps/api/src/routes/capabilityExecute.ts
import { Router } from 'express';
import { prisma } from '../prismaClient';
import { apiKeyAuth, ApiKeyRequest } from '../middleware/apiKeyAuth';
import { capabilityRateLimiter } from '../middleware/rateLimit';
import { requireFeatureApproved } from '../middleware/requireFeatureApproved';
import {
  assertFeatureRepositoryLicenseAllowsExecution,
  LicenseExecutionError,
} from '../services/licenseGuard';
import { adapterQueue } from '../queue/adapterQueue';

const router = Router();

// POST /capabilities/:featureId/execute
router.post(
  '/capabilities/:featureId/execute',
  apiKeyAuth,
  capabilityRateLimiter,
  requireFeatureApproved('ESLint'),
  async (req, res) => {
    try {
      const apiReq = req as ApiKeyRequest;
      const { featureId } = req.params;
      const featureIdNum = Number(featureId);

      if (Number.isNaN(featureIdNum) || featureIdNum <= 0) {
        return res.status(400).json({ error: 'Invalid featureId' });
      }

      if (!apiReq.projectId) {
        return res.status(400).json({ error: 'No project bound to API key' });
      }

      const feature = await prisma.features.findUnique({
        where: { id: featureIdNum },
        include: { repositories: true },
      });

      if (!feature || !feature.repo_id || !feature.repositories) {
        return res
          .status(404)
          .json({ error: 'Feature or repository not found' });
      }

      const repositoryId = feature.repo_id;

      // license + project-level acceptance check
      await assertFeatureRepositoryLicenseAllowsExecution(
        featureIdNum,
        repositoryId,
        apiReq.projectId,
      );

      const adapterName = 'eslint';
      const { input } = req.body;

      const job = await adapterQueue.add('execute-adapter', {
        repositoryId,
        featureId: featureIdNum,
        projectId: apiReq.projectId,
        adapterName,
        filePath: null,
        input,
      });

      return res.json({
        jobId: job.id,
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