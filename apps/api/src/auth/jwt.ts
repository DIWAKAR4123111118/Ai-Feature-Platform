import jwt, { SignOptions, Secret } from 'jsonwebtoken';

/**
 * JWT payload used across the API.
 * tenantId and projectId are required for multi-tenant context.
 */
export interface JwtPayload {
  sub: string; // user id
  role: 'admin' | 'user' | 'system';
  tenantId: number;
  projectId: number | null;
  email?: string | null;  // <-- add this
}

const JWT_SECRET: Secret =
  process.env.JWT_SECRET || 'dev-insecure-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

export function signToken(payload: JwtPayload): string {
  const options: SignOptions = {
    algorithm: 'HS256',
    expiresIn: JWT_EXPIRES_IN as any,
  };

  return jwt.sign(payload, JWT_SECRET, options);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}