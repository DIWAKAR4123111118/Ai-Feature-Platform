// apps/api/src/middleware/rateLimit.ts
import rateLimit from 'express-rate-limit';
import type { Request } from 'express';
import type { ApiKeyRequest } from './apiKeyAuth';

export const capabilityRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests / minute / API key
  keyGenerator: (req: Request): string => {
    const apiReq = req as ApiKeyRequest;

    if (apiReq.projectId) {
      return `project:${apiReq.projectId}`;
    }

    // Fallbacks to ensure we ALWAYS return a string
    const ip =
      (req.ip && req.ip.toString()) ||
      (req.headers['x-forwarded-for'] as string | undefined) ||
      'unknown';

    return `ip:${ip}`;
  },
});