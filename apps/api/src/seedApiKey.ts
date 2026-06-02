// apps/api/src/seedApiKey.ts
import { prisma } from './prismaClient';

async function main() {
  const apiKey = process.env.NEW_API_KEY;
  if (!apiKey) {
    console.error('NEW_API_KEY env var is not set');
    process.exit(1);
  }

  // Create tenant if needed
  const tenant = await prisma.tenants.upsert({
    where: { id: 1 },
    update: { name: 'local-dev-tenant' },
    create: {
      id: 1,
      name: 'local-dev-tenant',
    },
  });

  // Create a project if it doesn't exist
  const project = await prisma.projects.upsert({
    where: { id: 1 },
    update: { name: 'ai-feature-platform', tenant_id: tenant.id },
    create: {
      id: 1,
      tenant_id: tenant.id,
      name: 'ai-feature-platform',
    },
  });

  // Create API key (raw for now)
  const keyRecord = await prisma.project_api_keys.upsert({
    where: { key: apiKey },
    update: {
      name: 'local-dev-key',
      active: true,
      project_id: project.id,
    },
    create: {
      project_id: project.id,
      key: apiKey,
      name: 'local-dev-key',
      active: true,
    },
  });

  console.log('TENANT_ID', tenant.id);
  console.log('PROJECT_ID', project.id);
  console.log('API_KEY', apiKey);
  console.log('KEY_RECORD', keyRecord);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});