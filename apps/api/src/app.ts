import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { logger } from './logger';
import featuresRouter from './routes/features';
import scansRouter from './routes/scans';
import authRouter from './routes/auth';
import repositoriesRouter from './routes/repositories';
import internalRouter from './routes/internal';
import adaptersRouter from './routes/adapters';
import analysisRouter from './routes/analysis';


const app = express();


// Middleware
app.use(cors());
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


app.use('/auth', authRouter);
app.use('/repositories', repositoriesRouter);
app.use('/adapters', adaptersRouter);
app.use('/analysis', analysisRouter);
app.use('/api', scansRouter);
app.use('/features', featuresRouter);
app.use('/internal', internalRouter);


// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error({ err, url: req.url }, 'Request error');
  res.status(500).json({ error: 'Internal server error' });
});


export default app;