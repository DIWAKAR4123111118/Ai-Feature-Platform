"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// apps/api/src/routes/projectLicenses.ts
const express_1 = require("express");
const prismaClient_1 = require("../prismaClient");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// POST /projects/:projectId/repositories/:repoId/license/accept
router.post('/projects/:projectId/repositories/:repoId/license/accept', auth_1.authMiddleware, async (req, res) => {
    try {
        const authReq = req;
        const { projectId, repoId } = authReq.params;
        const projectIdNum = Number(projectId);
        const repoIdNum = Number(repoId);
        if (Number.isNaN(projectIdNum) ||
            Number.isNaN(repoIdNum) ||
            projectIdNum <= 0 ||
            repoIdNum <= 0) {
            return res.status(400).json({ error: 'Invalid projectId or repoId' });
        }
        // ensure project belongs to tenant
        const project = await prismaClient_1.prisma.projects.findFirst({
            where: {
                id: projectIdNum,
                tenant_id: authReq.user.tenantId,
            },
        });
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        const repo = await prismaClient_1.prisma.repositories.findUnique({
            where: { id: repoIdNum },
        });
        if (!repo) {
            return res.status(404).json({ error: 'Repository not found' });
        }
        // only meaningful for risky licenses; still store tier for audit
        const licenseTier = repo.license_risk_tier ?? 'unknown';
        const record = await prismaClient_1.prisma.project_repo_licenses.upsert({
            where: {
                project_id_repository_id: {
                    project_id: projectIdNum,
                    repository_id: repoIdNum,
                },
            },
            update: {
                accepted: true,
                accepted_by: authReq.user.email,
                accepted_at: new Date(),
                license_tier: licenseTier,
            },
            create: {
                project_id: projectIdNum,
                repository_id: repoIdNum,
                accepted: true,
                accepted_by: authReq.user.email,
                accepted_at: new Date(),
                license_tier: licenseTier,
            },
        });
        return res.json({ projectRepoLicense: record });
    }
    catch (err) {
        return res.status(500).json({
            error: 'Failed to accept repository license for project',
            details: err?.message || String(err),
        });
    }
});
exports.default = router;
