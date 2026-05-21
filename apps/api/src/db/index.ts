import { Pool } from 'pg';
import { logger } from '../logger';

// Force dotenv to load from the correct path
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not defined in environment variables');
}

logger.info({ connectionString: connectionString.replace(/:[^:@]+@/, ':****@') }, 'Connecting to database');

export const pool = new Pool({
  connectionString,
});

pool.on('connect', () => {
  logger.info('Database connected successfully');
});

pool.on('error', (err) => {
  logger.error({ err }, 'Database connection error');
});