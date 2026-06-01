"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// apps/api/src/routes/adapters.ts
const express_1 = require("express");
const prismaClient_1 = require("../prismaClient");
const logger_1 = require("../logger");
const auth_1 = require("../middleware/auth");
const adapterExecutor_1 = require("../services/adapterExecutor");
const licenseGuard_1 = require("../services/licenseGuard");
const router = (0, express_1.Router)();
// Execute adapter on a repository
router.post('/:repositoryId/execute', auth_1.authMiddleware, async (req, res) => {
    try {
        const authReq = req;
        const { repositoryId } = authReq.params;
        const repositoryIdStr = Array.isArray(repositoryId)
            ? repositoryId[0]
            : repositoryId;
        const { adapterName, filePath, input } = authReq.body;
        if (!adapterName || !input) {
            return res
                .status(400)
                .json({ error: 'adapterName and input are required' });
        }
        const repoIdNum = parseInt(repositoryIdStr, 10);
        if (Number.isNaN(repoIdNum)) {
            return res
                .status(400)
                .json({ error: 'repositoryId must be a valid number' });
        }
        const repo = await prismaClient_1.prisma.repositories.findUnique({
            where: { id: repoIdNum },
            select: { id: true, name: true },
        });
        if (!repo) {
            return res.status(404).json({ error: 'Repository not found' });
        }
        await (0, licenseGuard_1.assertRepositoryLicenseAllowsExecution)(repoIdNum);
        const result = await (0, adapterExecutor_1.executeAdapter)({
            repositoryId: repoIdNum,
            adapterName,
            filePath,
            input,
        });
        return res.json({
            executionId: result.id,
            status: result.status,
            duration: result.duration,
            output: result.output,
            errorMessage: result.errorMessage,
        });
    }
    catch (error) {
        if (error instanceof licenseGuard_1.LicenseExecutionError) {
            return res.status(400).json({ error: error.message });
        }
        logger_1.logger.error({ error }, 'Failed to execute adapter');
        return res.status(500).json({ error: 'Failed to execute adapter' });
    }
});
// Get execution history for a repository
router.get('/:repositoryId/executions', auth_1.authMiddleware, async (req, res) => {
    try {
        const { repositoryId } = req.params;
        const repositoryIdStr = Array.isArray(repositoryId)
            ? repositoryId[0]
            : repositoryId;
        const { adapterName, status, limit = 50 } = req.query;
        const repoIdNum = parseInt(repositoryIdStr, 10);
        if (Number.isNaN(repoIdNum)) {
            return res
                .status(400)
                .json({ error: 'repositoryId must be a valid number' });
        }
        const take = Math.min(Number(limit) || 50, 200);
        const executions = await prismaClient_1.prisma.adapter_executions.findMany({
            where: {
                repository_id: repoIdNum,
                ...(adapterName
                    ? { adapter_name: String(adapterName) }
                    : {}),
                ...(status ? { status: String(status) } : {}),
            },
            orderBy: { executed_at: 'desc' },
            take,
            select: {
                id: true,
                adapter_name: true,
                file_path: true,
                status: true,
                duration: true,
                error_message: true,
                executed_at: true,
                feature_id: true,
                project_id: true,
            },
        });
        return res.json({ executions });
    }
    catch (error) {
        logger_1.logger.error({ error }, 'Failed to fetch executions');
        return res.status(500).json({ error: 'Failed to fetch executions' });
    }
});
// Get single execution details
router.get('/executions/:executionId', auth_1.authMiddleware, async (req, res) => {
    try {
        const { executionId } = req.params;
        const executionIdStr = Array.isArray(executionId)
            ? executionId[0]
            : executionId;
        const execution = await prismaClient_1.prisma.adapter_executions.findUnique({
            where: { id: executionIdStr },
        });
        if (!execution) {
            return res.status(404).json({ error: 'Execution not found' });
        }
        return res.json({ execution });
    }
    catch (error) {
        logger_1.logger.error({ error }, 'Failed to fetch execution');
        return res.status(500).json({ error: 'Failed to fetch execution' });
    }
});
exports.default = router;
