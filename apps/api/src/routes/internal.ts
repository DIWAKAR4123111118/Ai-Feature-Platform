// apps/api/src/routes/internal.ts
import { Router } from 'express';
import { prisma } from '../prismaClient';
import { logger } from '../logger';
import { executeAdapter } from '../services/adapterExecutor';
import {
  assertFeatureRepositoryLicenseAllowsExecution,
  LicenseExecutionError,
} from '../services/licenseGuard';
import { requireFeatureApproved } from '../middleware/requireFeatureApproved';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// POST /internal/features/:id/run
router.post(
  '/features/:id/run',
  authMiddleware,
  requireFeatureApproved('ESLint'),
  async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const { id } = authReq.params;
      const featureId = Number(id);

      if (Number.isNaN(featureId) || featureId <= 0) {
        return res.status(400).json({ error: 'Invalid featureId' });
      }

      const feature = await prisma.features.findUnique({
        where: { id: featureId },
        include: { repositories: true },
      });

      if (!feature) {
        return res.status(404).json({ error: 'Feature not found' });
      }

      if (!feature.repo_id || !feature.repositories) {
        return res.status(400).json({
          error:
            'Feature has no attached repository. Attach a repo before running adapters.',
        });
      }

      const repositoryId = feature.repo_id;
      const projectId = authReq.user.projectId ?? null;

      await assertFeatureRepositoryLicenseAllowsExecution(
        featureId,
        repositoryId,
        projectId,
      );

      const adapterName = 'eslint';

      const input = {
        featureId,
        repositoryId,
      };

      const result = await executeAdapter({
        repositoryId,
        featureId,
        adapterName,
        filePath: null,
        input,
      });

      return res.json({
        success: true,
        featureId,
        repositoryId,
        executionId: result.id,
        status: result.status,
        duration: result.duration,
        output: result.output,
        errorMessage: result.errorMessage,
      });
    } catch (error: any) {
      if (error instanceof LicenseExecutionError) {
        return res.status(400).json({ error: error.message });
      }

      logger.error(
        { error: error?.message || String(error) },
        'Feature execution error: internal feature run failed',
      );
      return res.status(500).json({
        error: 'Failed to execute feature',
        details: error?.message || String(error),
      });
    }
  },
);

export default router;
