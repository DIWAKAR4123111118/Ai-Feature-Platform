import express, { Request, Response, NextFunction } from 'express';
import { logger } from './logger';
import featuresRouter from './routes/features';

const app = express();

// Middleware
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  logger.info({ method: req.method, url: req.url }, 'Incoming request');
  next();
});

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/features', featuresRouter);

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error({ err, url: req.url }, 'Request error');
  res.status(500).json({ error: 'Internal server error' });
});

export default app;