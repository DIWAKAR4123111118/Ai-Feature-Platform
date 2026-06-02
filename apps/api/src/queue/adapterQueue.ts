// apps/api/src/queue/adapterQueue.ts
import { Queue } from 'bullmq';
import { getRedisConfig, isQueueEnabled } from '../config/redis';

export const ADAPTER_QUEUE_NAME = 'adapter-executions';

let adapterQueue: Queue | null = null;

export function getAdapterQueue(): Queue | null {
  if (!isQueueEnabled()) {
    return null;
  }

  if (!adapterQueue) {
    adapterQueue = new Queue(ADAPTER_QUEUE_NAME, {
      connection: getRedisConfig(),
      defaultJobOptions: {
        attempts: 3,
        removeOnComplete: 1000,
        removeOnFail: 1000,
      },
    });
  }

  return adapterQueue;
}