// apps/api/src/middleware/auth.ts
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../logger';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';

export interface AuthUserPayload {
  userId: number;
  email: string;
  tenantId: number;
  projectId: number | null;
  iat: number;
  exp: number;
}

// Narrowed request type you can cast to in handlers when you need user
export interface AuthRequest extends Request {
  user: AuthUserPayload;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUserPayload;
  }
}

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = header.slice('Bearer '.length).trim();

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUserPayload;
    req.user = decoded;
    return next();
  } catch (err: any) {
    logger.error({ error: err }, 'Token verification failed');
    return res.status(401).json({ error: 'Invalid token' });
  }
}