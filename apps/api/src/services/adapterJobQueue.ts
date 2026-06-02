// apps/api/src/services/adapterJobQueue.ts
import { getAdapterQueue } from '../queue/adapterQueue';
import { prisma } from '../prismaClient';

export interface EnqueueAdapterJobParams {
  adapterName: string;
  repositoryId: number;
  featureId: number;
  projectId?: number | null;
  tenantId?: number | null;
  filePath?: string | null;
  input: any;
}

export interface EnqueuedJobInfo {
  executionId: string;
  jobId: string;
}

export async function enqueueAdapterJob(
  params: EnqueueAdapterJobParams,
): Promise<EnqueuedJobInfo> {
  const {
    adapterName,
    repositoryId,
    featureId,
    projectId = null,
    tenantId = null,
    filePath = null,
    input,
  } = params;

  const execution = await prisma.adapter_executions.create({
    data: {
      repository_id: repositoryId,
      feature_id: featureId,
      project_id: projectId,
      // tenant_id is not yet a column in adapter_executions; add when you evolve schema
      adapter_name: adapterName,
      file_path: filePath,
      input,
      output: {},
      status: 'queued',
      duration: 0,
      error_message: null,
      lint_errors: 0,
      executed_at: new Date(),
    },
  });

  const queue = getAdapterQueue();
  if (!queue) {
    throw new Error('Queue is disabled but enqueueAdapterJob was called');
  }

  const job = await queue.add('execute-adapter', {
    executionId: execution.id,
    adapterName,
    repositoryId,
    featureId,
    projectId,
    tenantId,
    filePath,
    input,
  });

  return {
    executionId: execution.id,
    jobId: String(job.id),
  };
}