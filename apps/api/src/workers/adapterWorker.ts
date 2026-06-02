// apps/api/src/workers/adapterWorker.ts
import { Worker, Job } from 'bullmq';
import { ADAPTER_QUEUE_NAME } from '../queue/adapterQueue';
import { getRedisConfig, isQueueEnabled } from '../config/redis';
import { prisma } from '../prismaClient';
import { executeAdapter } from '../services/adapterExecutor';

interface AdapterJobData {
  executionId: string;
  adapterName: string;
  repositoryId: number;
  featureId: number;
  projectId: number | null;
  tenantId: number | null;
  filePath?: string | null;
  input: any;
}

export function startAdapterWorker() {
  if (!isQueueEnabled()) {
    console.log('[worker] Queue disabled; not starting adapter worker');
    return;
  }

  const worker = new Worker<AdapterJobData>(
    ADAPTER_QUEUE_NAME,
    async (job: Job<AdapterJobData>) => {
      const {
        executionId,
        adapterName,
        repositoryId,
        featureId,
        projectId,
        input,
      } = job.data;

      const exec = await prisma.adapter_executions.findUnique({
        where: { id: executionId },
      });

      if (!exec) {
        throw new Error(`adapter_execution not found: ${executionId}`);
      }

      await executeAdapter({
        executionId,
        repositoryId,
        featureId,
        projectId,
        adapterName,
        input,
      });
    },
    {
      connection: getRedisConfig(),
    },
  );

  worker.on('completed', (job) => {
    console.log('[worker] job completed', job.id);
  });

  worker.on('failed', (job, err) => {
    console.error('[worker] job failed', job?.id, err);
  });
}