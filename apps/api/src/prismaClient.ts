import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';
import { logger } from './logger';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not defined for Prisma');
}

logger.info(
  { connectionString: connectionString.replace(/:[^:@]+@/, ':****@') },
  'Prisma connecting to database',
);

export const prisma = new PrismaClient();