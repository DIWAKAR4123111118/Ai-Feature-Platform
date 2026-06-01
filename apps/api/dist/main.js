"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// apps/api/src/main.ts
const app_1 = __importDefault(require("./app"));
const env_1 = require("./config/env");
const logger_1 = require("./logger");
const port = env_1.config.port || 3000;
const server = app_1.default.listen(port, () => {
    logger_1.logger.info({ port, env: env_1.config.nodeEnv }, 'API server started');
});
const shutdown = () => {
    logger_1.logger.info('Shutdown signal received, closing server');
    server.close(err => {
        if (err) {
            logger_1.logger.error({ err }, 'Error during server close');
            process.exit(1);
        }
        logger_1.logger.info('Server closed cleanly');
        process.exit(0);
    });
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
