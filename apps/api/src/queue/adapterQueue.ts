// apps/api/src/queue/adapterQueue.ts
import { Queue } from 'bullmq';

const connection = {
  connection: {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  },
};

export const adapterQueue = new Queue('adapter-executions', {
  ...connection,
  defaultJobOptions: {
    attempts: 3,
    removeOnComplete: 1000,
    removeOnFail: 1000,
  },
});