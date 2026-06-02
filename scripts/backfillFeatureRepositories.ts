import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const features = await prisma.features.findMany({
    where: { repo_id: { not: null } },
    include: { repositories: true },
  });

  for (const feature of features) {
    if (!feature.repo_id || !feature.repositories) continue;

    const existing = await prisma.feature_repositories.findFirst({
      where: {
        feature_id: feature.id,
        repository_id: feature.repo_id,
      },
    });

    if (existing) continue;

    const repo: any = feature.repositories;

    await prisma.feature_repositories.create({
      data: {
        feature_id: feature.id,
        repository_id: feature.repo_id,
        licenseRiskTier: repo.license_risk_tier || 'unknown',
        licenseAccepted: repo.license_accepted ?? false,
        licenseAcceptedBy: repo.license_accepted_by || null,
        licenseAcceptedAt: repo.license_accepted_at || null,
        licenseText: repo.license_text || null,
      },
    });
  }

  await prisma.$disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  prisma.$disconnect().finally(() => process.exit(1));
});
