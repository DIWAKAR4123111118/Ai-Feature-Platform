"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adapterQueue = void 0;
// apps/api/src/queue/adapterQueue.ts
const bullmq_1 = require("bullmq");
const connection = {
    connection: {
        url: process.env.REDIS_URL ?? 'redis://localhost:6379',
    },
};
exports.adapterQueue = new bullmq_1.Queue('adapter-executions', {
    ...connection,
    defaultJobOptions: {
        attempts: 3,
        removeOnComplete: 1000,
        removeOnFail: 1000,
    },
});
