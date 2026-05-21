import { Router } from 'express';
import { pool } from '../db';
import { logger } from '../logger';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { cloneRepository, cleanupClone, getRepoFiles } from '../services/gitCloner';
import { executeAdapter } from '../services/adapterExecutor';

const router = Router();

// Clone repository and run all adapters
router.post('/:id/clone-and-analyze', authMiddleware, async (req: AuthRequest, res) => {
  let cloneDir: string | null = null;

  try {
    const { id } = req.params;

    const repoResult = await pool.query(
      'SELECT github_url, name FROM repositories WHERE id = $1',
      [id]
    );

    if (repoResult.rows.length === 0) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    const repo = repoResult.rows[0];
    logger.info({ repoId: id, repoName: repo.name }, 'Starting clone and analyze');

    cloneDir = await cloneRepository(repo.github_url);

    const files = await getRepoFiles(cloneDir);
    logger.info({ repoId: id, fileCount: files.length }, 'Found code files');

    const results: any[] = [];

    if (files.length > 0) {
      const eslintResult = await executeAdapter({
        repositoryId: parseInt(id),
        adapterName: 'eslint',
        input: {
          repoPath: cloneDir,
          files: ['.']
        }
      });
      results.push({ adapter: 'eslint', ...eslintResult });

      if (eslintResult.status === 'success' && eslintResult.output) {
        await pool.query(
          'UPDATE repositories SET quality_score = $1 WHERE id = $2',
          [100 - (eslintResult.output.totalErrors * 10), parseInt(id)]
        );
      }
    }

    const analysisResult = await pool.query(
      `SELECT quality_score, security_score FROM repositories WHERE id = $1`,
      [id]
    );

    res.json({
      message: 'Analysis complete',
      repository: {
        id: parseInt(id),
        name: repo.name,
        fileCount: files.length
      },
      results,
      scores: analysisResult.rows[0]
    });

  } catch (error: any) {
    logger.error({ error, repoId: req.params.id }, 'Clone and analyze failed');
    res.status(500).json({ error: error.message || 'Failed to clone and analyze' });
  } finally {
    if (cloneDir) {
      await cleanupClone(cloneDir);
    }
  }
});

// Get repository analysis summary
router.get('/:id/analysis', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const repoResult = await pool.query(
      `SELECT r.id, r.name, r.github_url, r.stars, r.quality_score, r.security_score,
              r.license_spdx, r.license_risk_tier, r.created_at,
              COUNT(ae.id) as execution_count
       FROM repositories r
       LEFT JOIN adapter_executions ae ON r.id = ae.repository_id
       WHERE r.id = $1
       GROUP BY r.id`,
      [id]
    );

    if (repoResult.rows.length === 0) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    const recentExecutions = await pool.query(
      `SELECT adapter_name, status, duration, executed_at 
       FROM adapter_executions 
       WHERE repository_id = $1 
       ORDER BY executed_at DESC 
       LIMIT 10`,
      [id]
    );

    res.json({
      repository: repoResult.rows[0],
      recentExecutions: recentExecutions.rows
    });

  } catch (error: any) {
    logger.error({ error }, 'Failed to fetch analysis');
    res.status(500).json({ error: 'Failed to fetch analysis' });
  }
});

export default router;