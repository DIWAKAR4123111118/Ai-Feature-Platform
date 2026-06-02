"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// apps/api/src/workers/adapterWorker.ts
const bullmq_1 = require("bullmq");
const adapterExecutor_1 = require("../services/adapterExecutor");
const logger_1 = require("../logger");
const worker = new bullmq_1.Worker('adapter-executions', async (job) => {
    const { repositoryId, featureId, adapterName, filePath, input, projectId } = job.data;
    logger_1.logger.info({ jobId: job.id, repositoryId, featureId, projectId, adapterName }, 'Processing adapter job');
    const result = await (0, adapterExecutor_1.executeAdapter)({
        repositoryId,
        featureId: featureId ?? null,
        projectId: projectId ?? null,
        adapterName,
        filePath: filePath ?? null,
        input,
    });
    return result;
}, {
    connection: {
        url: process.env.REDIS_URL ?? 'redis://localhost:6379',
    },
});
worker.on('completed', (job) => {
    logger_1.logger.info({ jobId: job.id }, 'Adapter job completed');
});
worker.on('failed', (job, err) => {
    logger_1.logger.error({ jobId: job?.id, error: err?.message || String(err) }, 'Adapter job failed');
});
