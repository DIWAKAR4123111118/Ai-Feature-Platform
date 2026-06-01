// apps/api/src/main.ts
import app from './app';
import { config } from './config/env';
import { logger } from './logger';

const port = config.port || 3000;

const server = app.listen(port, () => {
  logger.info({ port, env: config.nodeEnv }, 'API server started');
});

const shutdown = () => {
  logger.info('Shutdown signal received, closing server');

  server.close(err => {
    if (err) {
      logger.error({ err }, 'Error during server close');
      process.exit(1);
    }

    logger.info('Server closed cleanly');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);