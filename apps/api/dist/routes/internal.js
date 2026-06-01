"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// apps/api/src/routes/internal.ts
const express_1 = require("express");
const prismaClient_1 = require("../prismaClient");
const logger_1 = require("../logger");
const adapterExecutor_1 = require("../services/adapterExecutor");
const licenseGuard_1 = require("../services/licenseGuard");
const requireFeatureApproved_1 = require("../middleware/requireFeatureApproved");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// POST /internal/features/:id/run
router.post('/features/:id/run', auth_1.authMiddleware, (0, requireFeatureApproved_1.requireFeatureApproved)('ESLint'), async (req, res) => {
    try {
        const authReq = req;
        const { id } = authReq.params;
        const featureId = Number(id);
        if (Number.isNaN(featureId) || featureId <= 0) {
            return res.status(400).json({ error: 'Invalid featureId' });
        }
        const feature = await prismaClient_1.prisma.features.findUnique({
            where: { id: featureId },
            include: { repositories: true },
        });
        if (!feature) {
            return res.status(404).json({ error: 'Feature not found' });
        }
        if (!feature.repo_id || !feature.repositories) {
            return res.status(400).json({
                error: 'Feature has no attached repository. Attach a repo before running adapters.',
            });
        }
        const repositoryId = feature.repo_id;
        const projectId = authReq.user.projectId ?? null;
        await (0, licenseGuard_1.assertFeatureRepositoryLicenseAllowsExecution)(featureId, repositoryId, projectId);
        const adapterName = 'eslint';
        const input = {
            featureId,
            repositoryId,
        };
        const result = await (0, adapterExecutor_1.executeAdapter)({
            repositoryId,
            featureId,
            adapterName,
            filePath: null,
            input,
        });
        return res.json({
            success: true,
            featureId,
            repositoryId,
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
        logger_1.logger.error({ error: error?.message || String(error) }, 'Feature execution error: internal feature run failed');
        return res.status(500).json({
            error: 'Failed to execute feature',
            details: error?.message || String(error),
        });
    }
});
exports.default = router;
