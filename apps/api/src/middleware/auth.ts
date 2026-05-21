import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../logger';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export interface AuthRequest extends Request {
  user?: {
    userId: number;
    email: string;
  };
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const token = authHeader.substring(7);
    
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; email: string };
    
    req.user = decoded;
    next();
  } catch (error) {
    logger.error({ error }, 'Token verification failed');
    res.status(401).json({ error: 'Invalid token' });
  }
};