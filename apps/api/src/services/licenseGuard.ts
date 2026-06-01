// apps/api/src/services/licenseGuard.ts
import { prisma } from '../prismaClient';
import { isLicenseBlocked, isLicenseRisky } from './licensePolicy';

export class LicenseExecutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LicenseExecutionError';
  }
}

/**
 * Global repo-level guard.
 * Used when you don't have project context.
 */
export async function assertRepositoryLicenseAllowsExecution(
  repositoryId: number,
) {
  const repo = await prisma.repositories.findUnique({
    where: { id: repositoryId },
  });

  if (!repo) {
    throw new LicenseExecutionError('Repository not found');
  }

  const riskTier = repo.license_risk_tier;
  const accepted = repo.license_accepted;

  if (isLicenseBlocked(riskTier)) {
    throw new LicenseExecutionError(
      'Execution blocked due to license policy (blocked or unknown tier)',
    );
  }

  if (isLicenseRisky(riskTier) && !accepted) {
    throw new LicenseExecutionError(
      'Execution blocked: risky license must be explicitly accepted for this repository',
    );
  }
}

/**
 * Feature+repo-scoped guard for internal feature runs.
 * Optional projectId allows future per-project acceptance checks.
 */
export async function assertFeatureRepositoryLicenseAllowsExecution(
  featureId: number,
  repositoryId: number,
  projectId?: number | null,
) {
  const fr = await prisma.feature_repositories.findUnique({
    where: {
      feature_id_repository_id: {
        feature_id: featureId,
        repository_id: repositoryId,
      },
    },
    include: { repository: true },
  });

  if (!fr || !fr.repository) {
    throw new LicenseExecutionError(
      'Feature is not attached to this repository or repository not found',
    );
  }

  const repo = fr.repository;
  const riskTier = fr.licenseRiskTier || repo.license_risk_tier;
  let accepted = fr.licenseAccepted ?? repo.license_accepted;

  if (projectId && isLicenseRisky(riskTier)) {
    const prl = await prisma.project_repo_licenses.findUnique({
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

  if (isLicenseBlocked(riskTier)) {
    throw new LicenseExecutionError(
      'Execution blocked due to license policy (blocked or unknown tier) for this feature',
    );
  }

  if (isLicenseRisky(riskTier) && !accepted) {
    throw new LicenseExecutionError(
      'Execution blocked: risky license must be explicitly accepted before running this feature',
    );
  }
}
