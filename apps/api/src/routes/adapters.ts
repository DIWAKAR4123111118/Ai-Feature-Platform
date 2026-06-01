// apps/api/src/routes/adapters.ts
import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { logger } from '../logger';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { executeAdapter } from '../services/adapterExecutor';
import {
  assertRepositoryLicenseAllowsExecution,
  LicenseExecutionError,
} from '../services/licenseGuard';

const router = Router();

// Execute adapter on a repository
router.post(
  '/:repositoryId/execute',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const { repositoryId } = authReq.params;
      const repositoryIdStr = Array.isArray(repositoryId)
        ? repositoryId[0]
        : repositoryId;
      const { adapterName, filePath, input } = authReq.body;

      if (!adapterName || !input) {
        return res
          .status(400)
          .json({ error: 'adapterName and input are required' });
      }

      const repoIdNum = parseInt(repositoryIdStr, 10);
      if (Number.isNaN(repoIdNum)) {
        return res
          .status(400)
          .json({ error: 'repositoryId must be a valid number' });
      }

      const repo = await prisma.repositories.findUnique({
        where: { id: repoIdNum },
        select: { id: true, name: true },
      });

      if (!repo) {
        return res.status(404).json({ error: 'Repository not found' });
      }

      await assertRepositoryLicenseAllowsExecution(repoIdNum);

      const result = await executeAdapter({
        repositoryId: repoIdNum,
        adapterName,
        filePath,
        input,
      });

      return res.json({
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

      logger.error({ error }, 'Failed to execute adapter');
      return res.status(500).json({ error: 'Failed to execute adapter' });
    }
  },
);

// Get execution history for a repository
router.get(
  '/:repositoryId/executions',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { repositoryId } = req.params;
      const repositoryIdStr = Array.isArray(repositoryId)
        ? repositoryId[0]
        : repositoryId;
      const { adapterName, status, limit = 50 } = req.query;

      const repoIdNum = parseInt(repositoryIdStr, 10);
      if (Number.isNaN(repoIdNum)) {
        return res
          .status(400)
          .json({ error: 'repositoryId must be a valid number' });
      }

      const take = Math.min(Number(limit) || 50, 200);

      const executions = await prisma.adapter_executions.findMany({
        where: {
          repository_id: repoIdNum,
          ...(adapterName
            ? { adapter_name: String(adapterName) }
            : {}),
          ...(status ? { status: String(status) } : {}),
        },
        orderBy: { executed_at: 'desc' },
        take,
        select: {
          id: true,
          adapter_name: true,
          file_path: true,
          status: true,
          duration: true,
          error_message: true,
          executed_at: true,
          feature_id: true,
          project_id: true,
        },
      });

      return res.json({ executions });
    } catch (error: any) {
      logger.error({ error }, 'Failed to fetch executions');
      return res.status(500).json({ error: 'Failed to fetch executions' });
    }
  },
);

// Get single execution details
router.get(
  '/executions/:executionId',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { executionId } = req.params;
      const executionIdStr = Array.isArray(executionId)
        ? executionId[0]
        : executionId;

      const execution = await prisma.adapter_executions.findUnique({
        where: { id: executionIdStr },
      });

      if (!execution) {
        return res.status(404).json({ error: 'Execution not found' });
      }

      return res.json({ execution });
    } catch (error: any) {
      logger.error({ error }, 'Failed to fetch execution');
      return res.status(500).json({ error: 'Failed to fetch execution' });
    }
  },
);

export default router;