import jwt, { SignOptions, Secret } from 'jsonwebtoken';

const JWT_SECRET: Secret =
  process.env.JWT_SECRET || 'dev-insecure-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

export interface JwtPayload {
  sub: string; // user id
  role: 'admin' | 'user' | 'system';
}

export function signToken(payload: JwtPayload): string {
  const options: SignOptions = {
    algorithm: 'HS256',
    // env gives us a generic string; cast to satisfy SignOptions' StringValue union
    expiresIn: JWT_EXPIRES_IN as any,
  };

  return jwt.sign(payload, JWT_SECRET, options);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}