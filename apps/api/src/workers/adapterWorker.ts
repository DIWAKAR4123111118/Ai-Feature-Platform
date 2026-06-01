// apps/api/src/workers/adapterWorker.ts
import { Worker, Job } from 'bullmq';
import { executeAdapter } from '../services/adapterExecutor';
import { prisma } from '../prismaClient';
import { logger } from '../logger';

interface AdapterJobData {
  repositoryId: number;
  featureId?: number | null;
  projectId?: number | null;
  adapterName: string;
  filePath?: string | null;
  input: any;
}

const worker = new Worker<AdapterJobData>(
  'adapter-executions',
  async (job: Job<AdapterJobData>) => {
    const { repositoryId, featureId, adapterName, filePath, input, projectId } =
      job.data;

    logger.info(
      { jobId: job.id, repositoryId, featureId, projectId, adapterName },
      'Processing adapter job',
    );

    const result = await executeAdapter({
      repositoryId,
      featureId: featureId ?? null,
      adapterName,
      filePath: filePath ?? null,
      input,
    });

    if (projectId) {
      await prisma.adapter_executions.update({
        where: { id: result.id },
        data: {
          project_id: projectId,
        },
      });
    }

    return result;
  },
  {
    connection: {
      url: process.env.REDIS_URL ?? 'redis://localhost:6379',
    },
  },
);

worker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Adapter job completed');
});

worker.on('failed', (job, err) => {
  logger.error(
    { jobId: job?.id, error: err?.message || String(err) },
    'Adapter job failed',
  );
});