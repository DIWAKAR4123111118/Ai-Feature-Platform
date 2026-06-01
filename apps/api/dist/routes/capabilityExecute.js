"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// apps/api/src/routes/capabilityExecute.ts
const express_1 = require("express");
const prismaClient_1 = require("../prismaClient");
const apiKeyAuth_1 = require("../middleware/apiKeyAuth");
const rateLimit_1 = require("../middleware/rateLimit");
const requireFeatureApproved_1 = require("../middleware/requireFeatureApproved");
const licenseGuard_1 = require("../services/licenseGuard");
const adapterQueue_1 = require("../queue/adapterQueue");
const router = (0, express_1.Router)();
// POST /capabilities/:featureId/execute
router.post('/capabilities/:featureId/execute', apiKeyAuth_1.apiKeyAuth, rateLimit_1.capabilityRateLimiter, (0, requireFeatureApproved_1.requireFeatureApproved)('ESLint'), async (req, res) => {
    try {
        const apiReq = req;
        const { featureId } = req.params;
        const featureIdNum = Number(featureId);
        if (Number.isNaN(featureIdNum) || featureIdNum <= 0) {
            return res.status(400).json({ error: 'Invalid featureId' });
        }
        if (!apiReq.projectId) {
            return res.status(400).json({ error: 'No project bound to API key' });
        }
        const feature = await prismaClient_1.prisma.features.findUnique({
            where: { id: featureIdNum },
            include: { repositories: true },
        });
        if (!feature || !feature.repo_id || !feature.repositories) {
            return res
                .status(404)
                .json({ error: 'Feature or repository not found' });
        }
        const repositoryId = feature.repo_id;
        // license + project-level acceptance check
        await (0, licenseGuard_1.assertFeatureRepositoryLicenseAllowsExecution)(featureIdNum, repositoryId, apiReq.projectId);
        const adapterName = 'eslint';
        const { input } = req.body;
        const job = await adapterQueue_1.adapterQueue.add('execute-adapter', {
            repositoryId,
            featureId: featureIdNum,
            projectId: apiReq.projectId,
            adapterName,
            filePath: null,
            input,
        });
        return res.json({
            jobId: job.id,
            status: 'queued',
        });
    }
    catch (error) {
        if (error instanceof licenseGuard_1.LicenseExecutionError) {
            return res.status(400).json({ error: error.message });
        }
        return res.status(500).json({
            error: 'Failed to enqueue capability execution',
            details: error?.message || String(error),
        });
    }
});
exports.default = router;
