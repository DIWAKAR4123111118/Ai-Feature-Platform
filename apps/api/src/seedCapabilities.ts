// apps/api/src/seedCapabilities.ts
import { prisma } from './prismaClient';

async function main() {
  // Use an existing repository and feature
  const repo = await prisma.repositories.findFirst();
  if (!repo) {
    throw new Error('No repositories found. Run seedLocalDev first.');
  }

  const feature = await prisma.features.findFirst({
    where: { repo_id: repo.id },
  });
  if (!feature) {
    throw new Error('No features found for repo. Run seedLocalDev first.');
  }

  const slug = 'eslint-default'; // stable slug

  const capability = await prisma.capabilities.upsert({
    where: { slug },
    update: {
      name: feature.name,
      description: feature.description ?? 'ESLint capability for default repo',
      feature_id: feature.id,
      repository_id: repo.id,
      license_tier: repo.license_risk_tier,
      adapter_name: 'eslint',
      status: 'beta',
      visibility: 'public',
    },
    create: {
      slug,
      name: feature.name,
      description: feature.description ?? 'ESLint capability for default repo',
      feature_id: feature.id,
      repository_id: repo.id,
      license_tier: repo.license_risk_tier,
      adapter_name: 'eslint',
      status: 'beta',
      visibility: 'public',
    },
  });

  console.log('SEEDED_CAPABILITY', capability);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});