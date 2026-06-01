"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// apps/api/src/routes/analysis.ts
const express_1 = require("express");
const prismaClient_1 = require("../prismaClient");
const logger_1 = require("../logger");
const auth_1 = require("../middleware/auth");
const gitCloner_1 = require("../services/gitCloner");
const adapterExecutor_1 = require("../services/adapterExecutor");
const licenseGuard_1 = require("../services/licenseGuard");
const router = (0, express_1.Router)();
// Clone repository and run all adapters
router.post('/:id/clone-and-analyze', auth_1.authMiddleware, async (req, res) => {
    let cloneDir = null;
    try {
        const { id } = req.params;
        const idStr = Array.isArray(id) ? id[0] : id;
        const repoIdNum = parseInt(idStr, 10);
        if (Number.isNaN(repoIdNum)) {
            return res
                .status(400)
                .json({ error: 'Repository id must be a valid number' });
        }
        const repo = await prismaClient_1.prisma.repositories.findUnique({
            where: { id: repoIdNum },
            select: {
                id: true,
                github_url: true,
                name: true,
            },
        });
        if (!repo) {
            return res.status(404).json({ error: 'Repository not found' });
        }
        logger_1.logger.info({ repoId: repoIdNum, repoName: repo.name }, 'Starting clone and analyze');
        await (0, licenseGuard_1.assertRepositoryLicenseAllowsExecution)(repoIdNum);
        cloneDir = await (0, gitCloner_1.cloneRepository)(repo.github_url);
        const files = await (0, gitCloner_1.getRepoFiles)(cloneDir);
        logger_1.logger.info({ repoId: repoIdNum, fileCount: files.length }, 'Found code files');
        const results = [];
        if (files.length > 0) {
            const eslintResult = await (0, adapterExecutor_1.executeAdapter)({
                repositoryId: repoIdNum,
                adapterName: 'eslint',
                input: {
                    repoPath: cloneDir,
                    files: ['.'],
                },
            });
            results.push({ adapter: 'eslint', ...eslintResult });
            if (eslintResult.status === 'success' && eslintResult.output) {
                const output = eslintResult.output;
                const quality = Math.max(0, 100 - (Number(output.totalErrors) || 0) * 10);
                await prismaClient_1.prisma.repositories.update({
                    where: { id: repoIdNum },
                    data: {
                        quality_score: quality,
                    },
                });
            }
        }
        const analysis = await prismaClient_1.prisma.repositories.findUnique({
            where: { id: repoIdNum },
            select: {
                quality_score: true,
                security_score: true,
            },
        });
        return res.json({
            message: 'Analysis complete',
            repository: {
                id: repoIdNum,
                name: repo.name,
                fileCount: files.length,
            },
            results,
            scores: analysis,
        });
    }
    catch (error) {
        if (error instanceof licenseGuard_1.LicenseExecutionError) {
            return res.status(400).json({ error: error.message });
        }
        logger_1.logger.error({ error, repoId: req.params.id }, 'Clone and analyze failed');
        return res
            .status(500)
            .json({ error: error.message || 'Failed to clone and analyze' });
    }
    finally {
        if (cloneDir) {
            await (0, gitCloner_1.cleanupClone)(cloneDir);
        }
    }
});
// Get repository analysis summary
router.get('/:id/analysis', auth_1.authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const idStr = Array.isArray(id) ? id[0] : id;
        const repoIdNum = parseInt(idStr, 10);
        if (Number.isNaN(repoIdNum)) {
            return res
                .status(400)
                .json({ error: 'Repository id must be a valid number' });
        }
        const repository = await prismaClient_1.prisma.repositories.findUnique({
            where: { id: repoIdNum },
            select: {
                id: true,
                name: true,
                github_url: true,
                stars: true,
                quality_score: true,
                security_score: true,
                license_spdx: true,
                license_risk_tier: true,
                created_at: true,
            },
        });
        if (!repository) {
            return res.status(404).json({ error: 'Repository not found' });
        }
        const executionCount = await prismaClient_1.prisma.adapter_executions.count({
            where: { repository_id: repoIdNum },
        });
        const recentExecutions = await prismaClient_1.prisma.adapter_executions.findMany({
            where: { repository_id: repoIdNum },
            orderBy: { executed_at: 'desc' },
            take: 10,
            select: {
                adapter_name: true,
                status: true,
                duration: true,
                executed_at: true,
            },
        });
        return res.json({
            repository: {
                ...repository,
                execution_count: executionCount,
            },
            recentExecutions,
        });
    }
    catch (error) {
        logger_1.logger.error({ error }, 'Failed to fetch analysis');
        return res.status(500).json({ error: 'Failed to fetch analysis' });
    }
});
exports.default = router;
