import { Router, Request, Response } from 'express';
import { pool } from '../db';
import { logger } from '../logger';
import { authMiddleware } from '../middleware/auth';
import { scannerService } from '../services/scanner';
import { eslintRepoScanner } from '../services/eslintRepoScanner';

const router = Router();

// Trigger OSV scan for a repository
router.post(
  '/repositories/:id/scan',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const idStr = Array.isArray(id) ? id[0] : id;

      // Get repository details
      const repoResult = await pool.query(
        'SELECT * FROM repositories WHERE id = $1',
        [idStr],
      );

      if (repoResult.rows.length === 0) {
        return res.status(404).json({ error: 'Repository not found' });
      }

      const repo = repoResult.rows[0];

      // Create scan record
      const scanRecord = await pool.query(
        'INSERT INTO security_scans (repo_id, scan_type, vulnerabilities_count, passed) VALUES ($1, $2, $3, $4) RETURNING *',
        [idStr, 'osv-scanner', 0, false],
      );

      const scanId = scanRecord.rows[0].id;

      // Start async scan (don't await - run in background)
      performScan(scanId, repo).catch((err) => {
        logger.error({ err, scanId }, 'Background scan failed');
      });

      return res.status(202).json({
        message: 'Scan started',
        scanId,
        status: 'running',
      });
    } catch (error) {
      logger.error({ error }, 'Failed to start scan');
      return res.status(500).json({ error: 'Failed to start scan' });
    }
  },
);

// Get scan results
router.get(
  '/scans/:id',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const idStr = Array.isArray(id) ? id[0] : id;

      const scanResult = await pool.query(
        'SELECT * FROM security_scans WHERE id = $1',
        [idStr],
      );

      if (scanResult.rows.length === 0) {
        return res.status(404).json({ error: 'Scan not found' });
      }

      return res.json({ scan: scanResult.rows[0] });
    } catch (error) {
      logger.error({ error }, 'Failed to fetch scan');
      return res.status(500).json({ error: 'Failed to fetch scan' });
    }
  },
);

// Background OSV scan execution
async function performScan(scanId: number, repo: any) {
  let repoPath: string | null = null;

  try {
    logger.info(
      { scanId, repoUrl: repo.github_url },
      'Starting background scan',
    );

    // Clone repository
    repoPath = await scannerService.cloneRepository(repo.github_url, repo.id);

    // Run OSV scan
    const scanResult = await scannerService.runOSVScan(repoPath);

    // Update scan record
    await pool.query(
      'UPDATE security_scans SET vulnerabilities_count = $1, passed = $2, result = $3 WHERE id = $4',
      [
        scanResult.vulnerabilitiesCount,
        scanResult.status === 'passed',
        JSON.stringify(scanResult),
        scanId,
      ],
    );

    logger.info({ scanId, status: scanResult.status }, 'Scan completed');
  } catch (error) {
    logger.error({ error, scanId }, 'Scan execution failed');

    await pool.query(
      'UPDATE security_scans SET passed = $1, result = $2 WHERE id = $3',
      [false, JSON.stringify({ error: String(error) }), scanId],
    );
  } finally {
    if (repoPath) {
      await scannerService.cleanupWorkspace(repoPath);
    }
  }
}

// NEW: ESLint repo scan using adapter_executions + ESLint adapter
router.post(
  '/repositories/:id/eslint-scan',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const idStr = Array.isArray(id) ? id[0] : id;

      // Check repo exists (reuse DB via pool)
      const repoResult = await pool.query(
        'SELECT * FROM repositories WHERE id = $1',
        [idStr],
      );

      if (repoResult.rows.length === 0) {
        return res.status(404).json({ error: 'Repository not found' });
      }

      // Fire ESLint repo scan (background)
      const repositoryId = Number(idStr);

      eslintRepoScanner
        .scanRepo(repositoryId, 'eslint')
        .catch((err) => {
          logger.error(
            { err, repositoryId },
            'ESLint repo scan failed in background',
          );
        });

      return res.status(202).json({
        message: 'ESLint repo scan started',
        repositoryId,
        adapter: 'eslint',
      });
    } catch (error) {
      logger.error({ error }, 'Failed to start ESLint repo scan');
      return res.status(500).json({
        error: 'Failed to start ESLint repo scan',
      });
    }
  },
);

export default router;