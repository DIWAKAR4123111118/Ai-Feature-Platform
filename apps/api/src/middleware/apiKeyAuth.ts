// apps/api/src/middleware/apiKeyAuth.ts
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prismaClient';

declare module 'express-serve-static-core' {
  interface Request {
    projectId?: number;
    tenantId?: number;
  }
}

/**
 * API key authentication middleware.
 *
 * - Reads the key from x-api-key header.
 * - Validates it against project_api_keys.
 * - Ensures it is active and bound to a project.
 * - Attaches projectId and tenantId to the request.
 */
export async function apiKeyAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const apiKey = req.header('x-api-key');
    if (!apiKey) {
      return res.status(401).json({ error: 'Missing API key' });
    }

    const keyRecord = await prisma.project_api_keys.findUnique({
      where: { key: apiKey },
      include: { project: true },
    });

    if (!keyRecord || !keyRecord.active) {
      return res.status(401).json({ error: 'Invalid or inactive API key' });
    }

    if (!keyRecord.project_id) {
      return res.status(401).json({ error: 'API key not bound to a project' });
    }

    req.projectId = keyRecord.project_id;
    req.tenantId = keyRecord.project?.tenant_id ?? undefined;

    return next();
  } catch (err: any) {
    return res.status(500).json({
      error: 'API key auth failed',
      details: err?.message || String(err),
    });
  }
}