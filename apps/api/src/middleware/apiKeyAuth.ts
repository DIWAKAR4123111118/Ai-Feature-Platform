// apps/api/src/middleware/apiKeyAuth.ts
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prismaClient';

export interface ApiKeyRequest extends Request {
  projectId?: number;
}

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

    const apiReq = req as ApiKeyRequest;
    apiReq.projectId = keyRecord.project_id;

    return next();
  } catch (err: any) {
    return res.status(500).json({
      error: 'API key auth failed',
      details: err?.message || String(err),
    });
  }
}