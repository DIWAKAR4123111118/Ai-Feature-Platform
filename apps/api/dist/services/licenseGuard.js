"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LicenseExecutionError = void 0;
exports.assertRepositoryLicenseAllowsExecution = assertRepositoryLicenseAllowsExecution;
exports.assertFeatureRepositoryLicenseAllowsExecution = assertFeatureRepositoryLicenseAllowsExecution;
// apps/api/src/services/licenseGuard.ts
const prismaClient_1 = require("../prismaClient");
const licensePolicy_1 = require("./licensePolicy");
class LicenseExecutionError extends Error {
    constructor(message) {
        super(message);
        this.name = 'LicenseExecutionError';
    }
}
exports.LicenseExecutionError = LicenseExecutionError;
/**
 * Global repo-level guard.
 * Used when you don't have project context.
 */
async function assertRepositoryLicenseAllowsExecution(repositoryId) {
    const repo = await prismaClient_1.prisma.repositories.findUnique({
        where: { id: repositoryId },
    });
    if (!repo) {
        throw new LicenseExecutionError('Repository not found');
    }
    const riskTier = repo.license_risk_tier;
    const accepted = repo.license_accepted;
    if ((0, licensePolicy_1.isLicenseBlocked)(riskTier)) {
        throw new LicenseExecutionError('Execution blocked due to license policy (blocked or unknown tier)');
    }
    if ((0, licensePolicy_1.isLicenseRisky)(riskTier) && !accepted) {
        throw new LicenseExecutionError('Execution blocked: risky license must be explicitly accepted for this repository');
    }
}
/**
 * Feature+repo-scoped guard for internal feature runs.
 * Optional projectId allows future per-project acceptance checks.
 */
async function assertFeatureRepositoryLicenseAllowsExecution(featureId, repositoryId, projectId) {
    const fr = await prismaClient_1.prisma.feature_repositories.findUnique({
        where: {
            feature_id_repository_id: {
                feature_id: featureId,
                repository_id: repositoryId,
            },
        },
        include: { repository: true },
    });
    if (!fr || !fr.repository) {
        throw new LicenseExecutionError('Feature is not attached to this repository or repository not found');
    }
    const repo = fr.repository;
    const riskTier = fr.licenseRiskTier || repo.license_risk_tier;
    let accepted = fr.licenseAccepted ?? repo.license_accepted;
    if (projectId && (0, licensePolicy_1.isLicenseRisky)(riskTier)) {
        const prl = await prismaClient_1.prisma.project_repo_licenses.findUnique({
            where: {
                project_id_repository_id: {
                    project_id: projectId,
                    repository_id: repositoryId,
                },
            },
        });
        if (prl && prl.accepted) {
            accepted = true;
        }
    }
    if ((0, licensePolicy_1.isLicenseBlocked)(riskTier)) {
        throw new LicenseExecutionError('Execution blocked due to license policy (blocked or unknown tier) for this feature');
    }
    if ((0, licensePolicy_1.isLicenseRisky)(riskTier) && !accepted) {
        throw new LicenseExecutionError('Execution blocked: risky license must be explicitly accepted before running this feature');
    }
}
