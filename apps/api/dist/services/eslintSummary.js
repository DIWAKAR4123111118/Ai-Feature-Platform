"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeAndStoreEslintSummary = computeAndStoreEslintSummary;
const prismaClient_1 = require("../prismaClient");
/**
 * Compute ESLint summary for a repository and persist it on the repositories table.
 * v1: if there is at least one successful ESLint execution, mark as pass.
 */
async function computeAndStoreEslintSummary(repositoryId) {
    const executions = await prismaClient_1.prisma.adapter_executions.findMany({
        where: {
            repository_id: repositoryId,
            adapter_name: 'eslint',
        },
    });
    if (executions.length === 0) {
        const summary = {
            repositoryId,
            totalExecutions: 0,
            eslintStatus: 'unknown',
            totalLintErrors: 0,
        };
        await prismaClient_1.prisma.repositories.update({
            where: { id: repositoryId },
            data: {
                eslint_status: summary.eslintStatus,
                eslint_errors_count: 0,
                updated_at: new Date(),
            },
        });
        return summary;
    }
    const totalExecutions = executions.length;
    const anySuccess = executions.some((e) => e.status === 'success');
    const eslintStatus = anySuccess ? 'pass' : 'unknown';
    const summary = {
        repositoryId,
        totalExecutions,
        eslintStatus,
        totalLintErrors: 0, // TODO: aggregate real lint error counts
    };
    await prismaClient_1.prisma.repositories.update({
        where: { id: repositoryId },
        data: {
            eslint_status: summary.eslintStatus,
            eslint_errors_count: 0,
            updated_at: new Date(),
        },
    });
    return summary;
}
