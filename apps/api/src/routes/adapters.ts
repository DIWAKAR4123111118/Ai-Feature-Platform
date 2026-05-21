import { Router } from 'express';
import { pool } from '../db';
import { logger } from '../logger';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { executeAdapter } from '../services/adapterExecutor';

const router = Router();

// Execute adapter on a repository
router.post('/:repositoryId/execute', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { repositoryId } = req.params;
    const { adapterName, filePath, input } = req.body;

    if (!adapterName || !input) {
      return res.status(400).json({ error: 'adapterName and input are required' });
    }

    // Verify repository exists
    const repoResult = await pool.query(
      'SELECT id, name FROM repositories WHERE id = $1',
      [repositoryId]
    );

    if (repoResult.rows.length === 0) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    // Execute adapter
    const result = await executeAdapter({
      repositoryId: parseInt(repositoryId),
      adapterName,
      filePath,
      input
    });

    res.json({
      executionId: result.id,
      status: result.status,
      duration: result.duration,
      output: result.output,
      errorMessage: result.errorMessage
    });

  } catch (error: any) {
    logger.error({ error }, 'Failed to execute adapter');
    res.status(500).json({ error: 'Failed to execute adapter' });
  }
});

// Get execution history for a repository
router.get('/:repositoryId/executions', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { repositoryId } = req.params;
    const { adapterName, status, limit = 50 } = req.query;

    let query = `
      SELECT id, adapter_name, file_path, status, duration, error_message, executed_at
      FROM adapter_executions
      WHERE repository_id = $1
    `;
    const params: any[] = [repositoryId];

    if (adapterName) {
      params.push(adapterName);
      query += ` AND adapter_name = $${params.length}`;
    }

    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }

    params.push(limit);
    query += ` ORDER BY executed_at DESC LIMIT $${params.length}`;

    const result = await pool.query(query, params);

    res.json({ executions: result.rows });

  } catch (error: any) {
    logger.error({ error }, 'Failed to fetch executions');
    res.status(500).json({ error: 'Failed to fetch executions' });
  }
});

// Get single execution details
router.get('/executions/:executionId', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { executionId } = req.params;

    const result = await pool.query(
      'SELECT * FROM adapter_executions WHERE id = $1',
      [executionId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Execution not found' });
    }

    res.json({ execution: result.rows[0] });

  } catch (error: any) {
    logger.error({ error }, 'Failed to fetch execution');
    res.status(500).json({ error: 'Failed to fetch execution' });
  }
});

export default router;