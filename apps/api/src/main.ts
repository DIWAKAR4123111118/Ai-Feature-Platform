// apps/api/src/main.ts
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { logger } from './logger';
import internalRouter from './routes/internal';
import capabilitiesCatalogRouter from './routes/capabilitiesCatalog';
import capabilitiesExecuteRouter from './routes/capabilitiesExecute';
import projectsRouter from './routes/projects';
import capabilityExecuteRouter from './routes/capabilityExecute'; // legacy/internal by featureId
import executionsRouter from './routes/executions';
import { startAdapterWorker } from './workers/adapterWorker';

console.log('*** main.ts loaded ***');

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Legacy featureId executor is now internal-only
console.log(
  'capabilityExecuteRouter typeof:',
  typeof capabilityExecuteRouter,
  'hasUse:',
  typeof (capabilityExecuteRouter as any).use,
);

// PUBLIC / API-KEY ROUTES (capability catalog + execution by slug)
app.use('/capabilities', capabilitiesCatalogRouter);
app.use('/capabilities', capabilitiesExecuteRouter);

// PUBLIC / API-KEY EXECUTION RETRIEVAL
app.use('/executions', executionsRouter);

// INTERNAL SERVICE ROUTES (JWT-authenticated, used by workers/adapters)
app.use('/internal', internalRouter);

// INTERNAL ADMIN ROUTES (tenants/projects/api keys)
app.use('/internal', projectsRouter);

// INTERNAL LEGACY FEATURE-ID EXECUTOR
app.use('/internal', capabilityExecuteRouter);

// Healthcheck
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const PORT = Number(process.env.PORT || 3000);
const ENV = process.env.NODE_ENV || 'development';

// Start BullMQ worker in this process for now
startAdapterWorker();

app.listen(PORT, () => {
  logger.info({ port: PORT, env: ENV }, 'API server started');
});