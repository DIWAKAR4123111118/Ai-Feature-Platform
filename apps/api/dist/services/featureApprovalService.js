"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeatureApprovalError = void 0;
exports.approveFeature = approveFeature;
exports.rejectFeature = rejectFeature;
const prismaClient_1 = require("../prismaClient");
const logger_1 = require("../logger");
const eslintSummary_1 = require("./eslintSummary");
class FeatureApprovalError extends Error {
    constructor(message) {
        super(message);
        this.name = 'FeatureApprovalError';
    }
}
exports.FeatureApprovalError = FeatureApprovalError;
async function approveFeature(featureId, approvedBy) {
    const feature = await prismaClient_1.prisma.features.findUnique({
        where: { id: featureId },
        include: { repositories: true },
    });
    if (!feature) {
        throw new FeatureApprovalError('Feature not found');
    }
    if (!feature.repo_id || !feature.repositories) {
        throw new FeatureApprovalError('Feature has no attached repository');
    }
    const repo = feature.repositories;
    if (!repo.license_risk_tier ||
        repo.license_risk_tier === 'blocked' ||
        (repo.license_risk_tier === 'risky' && !repo.license_accepted)) {
        throw new FeatureApprovalError('Repository license policy not satisfied for approval');
    }
    if (repo.eslint_status !== 'pass') {
        throw new FeatureApprovalError('Repository ESLint status must be pass before approving feature');
    }
    const updatedFeature = await prismaClient_1.prisma.features.update({
        where: { id: featureId },
        data: {
            approved: true,
            status: 'approved',
            updated_at: new Date(),
        },
        include: { repositories: true },
    });
    await (0, eslintSummary_1.computeAndStoreEslintSummary)(repo.id);
    logger_1.logger.info({ featureId, approvedBy, repoId: repo.id }, 'Feature approved');
    return updatedFeature;
}
async function rejectFeature(featureId, reason) {
    const feature = await prismaClient_1.prisma.features.findUnique({
        where: { id: featureId },
        include: { repositories: true },
    });
    if (!feature) {
        throw new FeatureApprovalError('Feature not found');
    }
    const updatedFeature = await prismaClient_1.prisma.features.update({
        where: { id: featureId },
        data: {
            approved: false,
            status: 'rejected',
            updated_at: new Date(),
        },
        include: { repositories: true },
    });
    if (reason) {
        logger_1.logger.info({ featureId, reason }, 'Feature rejected with reason');
    }
    else {
        logger_1.logger.info({ featureId }, 'Feature rejected without explicit reason');
    }
    return updatedFeature;
}
