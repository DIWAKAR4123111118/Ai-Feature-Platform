import { prisma } from '../prismaClient';

export type EslintStatus = 'pass' | 'fail' | 'unknown';

export interface EslintSummary {
  repositoryId: number;
  totalExecutions: number;
  eslintStatus: EslintStatus;
  totalLintErrors: number;
}

/**
 * Compute ESLint summary for a repository and persist it on the repositories table.
 * v1: if there is at least one successful ESLint execution, mark as pass.
 */
export async function computeAndStoreEslintSummary(
  repositoryId: number,
): Promise<EslintSummary> {
  const executions = await prisma.adapter_executions.findMany({
    where: {
      repository_id: repositoryId,
      adapter_name: 'eslint',
    },
  });

  if (executions.length === 0) {
    const summary: EslintSummary = {
      repositoryId,
      totalExecutions: 0,
      eslintStatus: 'unknown',
      totalLintErrors: 0,
    };

    await prisma.repositories.update({
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

  const eslintStatus: EslintStatus = anySuccess ? 'pass' : 'unknown';

  const summary: EslintSummary = {
    repositoryId,
    totalExecutions,
    eslintStatus,
    totalLintErrors: 0, // TODO: aggregate real lint error counts
  };

  await prisma.repositories.update({
    where: { id: repositoryId },
    data: {
      eslint_status: summary.eslintStatus,
      eslint_errors_count: 0,
      updated_at: new Date(),
    },
  });

  return summary;
}