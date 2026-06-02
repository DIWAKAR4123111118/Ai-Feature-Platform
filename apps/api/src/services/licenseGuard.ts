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
 * Feature+repo-scoped guard for internal and project-scoped runs.
 * If projectId is provided, consult project_repo_licenses for per-project acceptance.
 *
 * Rules:
 * - Feature must be attached to the repository (via features.repo_id).
 * - Blocked / unclassified licenses are always blocked.
 * - Risky licenses require explicit acceptance:
 *   - via feature_repositories.licenseAccepted, or
 *   - via repositories.license_accepted, or
 *   - via project_repo_licenses.accepted for the given project.
 */
export async function assertFeatureRepositoryLicenseAllowsExecution(
  featureId: number,
  repositoryId: number,
  projectId?: number | null,
) {
  // 1) Load feature and its repository relationship
  const feature = await prisma.features.findUnique({
    where: { id: featureId },
    include: { repositories: true },
  });

  if (!feature || !feature.repositories) {
    throw new LicenseExecutionError(
      'Feature is not attached to any repository or repository not found',
    );
  }

  const repo = feature.repositories;

  if (repo.id !== repositoryId) {
    throw new LicenseExecutionError(
      'Feature is not attached to this repository or repository mismatch',
    );
  }

  // 2) Optionally load feature_repositories row
  const fr = await prisma.feature_repositories.findUnique({
    where: {
      feature_id_repository_id: {
        feature_id: featureId,
        repository_id: repositoryId,
      },
    },
  }).catch(() => null);

  // Prefer feature-level risk tier if present, otherwise repo-level
  const riskTier = fr?.licenseRiskTier || repo.license_risk_tier;
  let accepted = fr?.licenseAccepted ?? repo.license_accepted ?? false;

  // 3) Project-specific acceptance override for risky licenses
  if (projectId && isLicenseRisky(riskTier)) {
    const prl = await prisma.project_repo_licenses.findUnique({
      where: {
        project_id_repository_id: {
          project_id: projectId,
          repository_id: repositoryId,
        },
      },
    }).catch(() => null);

    if (prl && prl.accepted) {
      accepted = true;
    }
  }

  // 4) Blocked or unknown tier => hard block
  if (isLicenseBlocked(riskTier)) {
    throw new LicenseExecutionError(
      'Execution blocked due to license policy (blocked or unknown tier) for this feature',
    );
  }

  // 5) Risky and not accepted => block
  if (isLicenseRisky(riskTier) && !accepted) {
    throw new LicenseExecutionError(
      'Execution blocked: risky license must be explicitly accepted before running this feature',
    );
  }

  // For safe/low tiers and accepted=false, allow execution.
}