"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdapterExecutionError = void 0;
exports.executeAdapter = executeAdapter;
const node_fetch_1 = __importDefault(require("node-fetch"));
const prismaClient_1 = require("../prismaClient");
const logger_1 = require("../logger");
class AdapterExecutionError extends Error {
    constructor(message) {
        super(message);
        this.name = 'AdapterExecutionError';
    }
}
exports.AdapterExecutionError = AdapterExecutionError;
async function executeAdapter(params) {
    const { repositoryId, featureId = null, adapterName, filePath = null, input, } = params;
    if (adapterName !== 'eslint') {
        throw new AdapterExecutionError(`Unsupported adapter: ${adapterName}`);
    }
    const startedAt = Date.now();
    const execution = await prismaClient_1.prisma.adapter_executions.create({
        data: {
            repository_id: repositoryId,
            feature_id: featureId,
            adapter_name: adapterName,
            file_path: filePath,
            input,
            output: {},
            status: 'pending',
            duration: 0,
            error_message: null,
            lint_errors: 0,
        },
    });
    let status = 'error';
    let output = null;
    let errorMessage = null;
    let lintErrors = 0;
    try {
        const baseUrl = process.env.API_BASE_URL ?? 'http://localhost:3000';
        const token = process.env.INTERNAL_SERVICE_JWT;
        const response = await (0, node_fetch_1.default)(`${baseUrl}/internal/features/eslint/run`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ input }),
        });
        const duration = Date.now() - startedAt;
        if (!response.ok) {
            const text = await response.text();
            status = 'error';
            errorMessage = `ESLint adapter failed: ${response.status} ${text}`;
            await prismaClient_1.prisma.adapter_executions.update({
                where: { id: execution.id },
                data: {
                    status,
                    duration,
                    error_message: errorMessage,
                    output: {},
                    lint_errors: 0,
                },
            });
            logger_1.logger.error({
                executionId: execution.id,
                repositoryId,
                featureId,
                adapterName,
                status,
                duration,
                errorMessage,
            }, 'Adapter execution failed');
            throw new AdapterExecutionError(errorMessage);
        }
        const resultJson = await response.json();
        status = 'success';
        output = resultJson;
        lintErrors =
            typeof resultJson.errorCount === 'number' ? resultJson.errorCount : 0;
        await prismaClient_1.prisma.adapter_executions.update({
            where: { id: execution.id },
            data: {
                status,
                duration,
                output: resultJson,
                error_message: null,
                lint_errors: lintErrors,
            },
        });
        logger_1.logger.info({
            executionId: execution.id,
            repositoryId,
            featureId,
            adapterName,
            status,
            duration,
            lintErrors,
        }, 'Adapter execution succeeded');
        return {
            id: execution.id,
            status,
            duration,
            output,
            errorMessage: null,
        };
    }
    catch (err) {
        const duration = Date.now() - startedAt;
        await prismaClient_1.prisma.adapter_executions.update({
            where: { id: execution.id },
            data: {
                status: 'error',
                duration,
                error_message: err?.message || String(err),
            },
        });
        logger_1.logger.error({
            executionId: execution.id,
            repositoryId,
            featureId,
            adapterName,
            error: err?.message || String(err),
            duration,
        }, 'Adapter execution threw');
        throw err;
    }
}
