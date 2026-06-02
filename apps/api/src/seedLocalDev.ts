// apps/api/src/seedLocalDev.ts
import { prisma } from './prismaClient';

async function main() {
  // 1. Seed a tenant (single-tenant for now)
  const tenant = await prisma.tenants.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: 'local-tenant',
    },
  });

  // 2. Seed a project under that tenant
  const project = await prisma.projects.upsert({
    where: { id: 1 },
    update: { name: 'local-dev-project' },
    create: {
      id: 1,
      tenant_id: tenant.id,
      name: 'local-dev-project',
    },
  });

  // 3. Seed a repository as capability provider
  const repo = await prisma.repositories.upsert({
    where: { id: 1 },
    update: { name: 'eslint-adapter', github_url: 'https://github.com/your/eslint-adapter' },
    create: {
      id: 1,
      github_url: 'https://github.com/your/eslint-adapter',
      name: 'eslint-adapter',
      status: 'ready',
      license_risk_tier: 'low',
      license_accepted: true,
    },
  });

  // 4. Seed a feature (capability) implemented by that repo
  const feature = await prisma.features.upsert({
    where: { id: 1 },
    update: {
      name: 'ESLint analysis',
      repo_id: repo.id,
      status: 'approved',
      approved: true,
    },
    create: {
      id: 1,
      name: 'ESLint analysis',
      repo_id: repo.id,
      status: 'approved',
      approved: true,
    },
  });

  // 5. Seed a passing security scan for governance
  await prisma.security_scans.upsert({
    where: { id: 1 },
    update: {
      repo_id: repo.id,
      scan_type: 'osv',
      vulnerabilities_count: 0,
      passed: true,
    },
    create: {
      id: 1,
      repo_id: repo.id,
      scan_type: 'osv',
      vulnerabilities_count: 0,
      passed: true,
    },
  });

  // 6. Generate and seed an API key for this project
  const apiKey = require('crypto').randomBytes(32).toString('hex');

  const keyRecord = await prisma.project_api_keys.create({
    data: {
      project_id: project.id,
      key: apiKey,
      name: 'local-dev-key',
      active: true,
    },
  });

  console.log('TENANT_ID', tenant.id);
  console.log('PROJECT_ID', project.id);
  console.log('FEATURE_ID (ESLint)', feature.id);
  console.log('REPO_ID', repo.id);
  console.log('LOCAL_API_KEY', keyRecord.key);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});