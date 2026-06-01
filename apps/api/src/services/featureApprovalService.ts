import { prisma } from '../prismaClient';
import { logger } from '../logger';
import { computeAndStoreEslintSummary } from './eslintSummary';

export class FeatureApprovalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FeatureApprovalError';
  }
}

interface FeatureWithRepo {
  id: number;
  name: string;
  description: string | null;
  status: string | null;
  approved: boolean | null;
  repo_id: number | null;
  repositories?: {
    id: number;
    github_url: string;
    name: string;
    license_risk_tier?: string | null;
    license_accepted?: boolean | null;
    eslint_status?: string | null;
  } | null;
}

export async function approveFeature(
  featureId: number,
  approvedBy: string | null,
): Promise<FeatureWithRepo> {
  const feature = await prisma.features.findUnique({
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

  if (
    !repo.license_risk_tier ||
    repo.license_risk_tier === 'blocked' ||
    (repo.license_risk_tier === 'risky' && !repo.license_accepted)
  ) {
    throw new FeatureApprovalError(
      'Repository license policy not satisfied for approval',
    );
  }

  if (repo.eslint_status !== 'pass') {
    throw new FeatureApprovalError(
      'Repository ESLint status must be pass before approving feature',
    );
  }

  const updatedFeature = await prisma.features.update({
    where: { id: featureId },
    data: {
      approved: true,
      status: 'approved',
      updated_at: new Date(),
    },
    include: { repositories: true },
  });

  await computeAndStoreEslintSummary(repo.id);

  logger.info(
    { featureId, approvedBy, repoId: repo.id },
    'Feature approved',
  );

  return updatedFeature as unknown as FeatureWithRepo;
}

export async function rejectFeature(
  featureId: number,
  reason: string | null,
): Promise<FeatureWithRepo> {
  const feature = await prisma.features.findUnique({
    where: { id: featureId },
    include: { repositories: true },
  });

  if (!feature) {
    throw new FeatureApprovalError('Feature not found');
  }

  const updatedFeature = await prisma.features.update({
    where: { id: featureId },
    data: {
      approved: false,
      status: 'rejected',
      updated_at: new Date(),
    },
    include: { repositories: true },
  });

  if (reason) {
    logger.info({ featureId, reason }, 'Feature rejected with reason');
  } else {
    logger.info({ featureId }, 'Feature rejected without explicit reason');
  }

  return updatedFeature as unknown as FeatureWithRepo;
}