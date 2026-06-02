// apps/api/src/routes/executions.ts
import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { apiKeyAuth } from '../middleware/apiKeyAuth';

const router = Router();

// GET /executions/:id
router.get('/:id', apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const projectId = req.projectId;
    const id = req.params.id;

    if (!tenantId || !projectId) {
      return res.status(400).json({ error: 'Auth context missing' });
    }

    const exec = await prisma.adapter_executions.findUnique({
      where: { id },
    });

    if (!exec || exec.project_id !== projectId) {
      return res.status(404).json({ error: 'Execution not found' });
    }

    // tenant_id is not yet stored; this will be tightened when you add tenant_id to adapter_executions
    return res.json({
      id: exec.id,
      status: exec.status,
      duration: exec.duration,
      errorMessage: exec.error_message,
      output: exec.output,
      executedAt: exec.executed_at,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message ?? 'Failed to fetch execution' });
  }
});

export default router;