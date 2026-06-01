// apps/api/src/routes/analysis.ts
import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { logger } from '../logger';
import { authMiddleware } from '../middleware/auth';
import {
  cloneRepository,
  cleanupClone,
  getRepoFiles,
} from '../services/gitCloner';
import { executeAdapter } from '../services/adapterExecutor';
import {
  assertRepositoryLicenseAllowsExecution,
  LicenseExecutionError,
} from '../services/licenseGuard';

const router = Router();

type EslintOutput = {
  totalErrors: number;
  [key: string]: unknown;
};

// Clone repository and run all adapters
router.post(
  '/:id/clone-and-analyze',
  authMiddleware,
  async (req: Request, res: Response) => {
    let cloneDir: string | null = null;

    try {
      const { id } = req.params;
      const idStr = Array.isArray(id) ? id[0] : id;

      const repoIdNum = parseInt(idStr, 10);
      if (Number.isNaN(repoIdNum)) {
        return res
          .status(400)
          .json({ error: 'Repository id must be a valid number' });
      }

      const repo = await prisma.repositories.findUnique({
        where: { id: repoIdNum },
        select: {
          id: true,
          github_url: true,
          name: true,
        },
      });

      if (!repo) {
        return res.status(404).json({ error: 'Repository not found' });
      }

      logger.info(
        { repoId: repoIdNum, repoName: repo.name },
        'Starting clone and analyze',
      );

      await assertRepositoryLicenseAllowsExecution(repoIdNum);

      cloneDir = await cloneRepository(repo.github_url);

      const files = await getRepoFiles(cloneDir);
      logger.info(
        { repoId: repoIdNum, fileCount: files.length },
        'Found code files',
      );

      const results: any[] = [];

      if (files.length > 0) {
        const eslintResult = await executeAdapter({
          repositoryId: repoIdNum,
          adapterName: 'eslint',
          input: {
            repoPath: cloneDir,
            files: ['.'],
          },
        });
        results.push({ adapter: 'eslint', ...eslintResult });

        if (eslintResult.status === 'success' && eslintResult.output) {
          const output = eslintResult.output as EslintOutput;
          const quality = Math.max(
            0,
            100 - (Number(output.totalErrors) || 0) * 10,
          );

          await prisma.repositories.update({
            where: { id: repoIdNum },
            data: {
              quality_score: quality,
            },
          });
        }
      }

      const analysis = await prisma.repositories.findUnique({
        where: { id: repoIdNum },
        select: {
          quality_score: true,
          security_score: true,
        },
      });

      return res.json({
        message: 'Analysis complete',
        repository: {
          id: repoIdNum,
          name: repo.name,
          fileCount: files.length,
        },
        results,
        scores: analysis,
      });
    } catch (error: any) {
      if (error instanceof LicenseExecutionError) {
        return res.status(400).json({ error: error.message });
      }

      logger.error({ error, repoId: req.params.id }, 'Clone and analyze failed');
      return res
        .status(500)
        .json({ error: error.message || 'Failed to clone and analyze' });
    } finally {
      if (cloneDir) {
        await cleanupClone(cloneDir);
      }
    }
  },
);

// Get repository analysis summary
router.get(
  '/:id/analysis',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const idStr = Array.isArray(id) ? id[0] : id;

      const repoIdNum = parseInt(idStr, 10);
      if (Number.isNaN(repoIdNum)) {
        return res
          .status(400)
          .json({ error: 'Repository id must be a valid number' });
      }

      const repository = await prisma.repositories.findUnique({
        where: { id: repoIdNum },
        select: {
          id: true,
          name: true,
          github_url: true,
          stars: true,
          quality_score: true,
          security_score: true,
          license_spdx: true,
          license_risk_tier: true,
          created_at: true,
        },
      });

      if (!repository) {
        return res.status(404).json({ error: 'Repository not found' });
      }

      const executionCount = await prisma.adapter_executions.count({
        where: { repository_id: repoIdNum },
      });

      const recentExecutions = await prisma.adapter_executions.findMany({
        where: { repository_id: repoIdNum },
        orderBy: { executed_at: 'desc' },
        take: 10,
        select: {
          adapter_name: true,
          status: true,
          duration: true,
          executed_at: true,
        },
      });

      return res.json({
        repository: {
          ...repository,
          execution_count: executionCount,
        },
        recentExecutions,
      });
    } catch (error: any) {
      logger.error({ error }, 'Failed to fetch analysis');
      return res.status(500).json({ error: 'Failed to fetch analysis' });
    }
  },
);

export default router;
