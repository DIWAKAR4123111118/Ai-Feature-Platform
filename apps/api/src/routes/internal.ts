// apps/api/src/routes/internal.ts
import { Router, Request, Response } from 'express';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { prisma } from '../prismaClient';
import { logger } from '../logger';
import {
  assertFeatureRepositoryLicenseAllowsExecution,
  LicenseExecutionError,
} from '../services/licenseGuard';

const router = Router();

console.log('internal.ts: Router created');

function resolveRepoPath(repoName: string): string {
  const root = process.env.REPO_CHECKOUT_ROOT;
  if (!root) {
    throw new Error('REPO_CHECKOUT_ROOT is not configured');
  }
  return path.join(root, repoName);
}

async function runEslintAdapter(input: any): Promise<any> {
  return new Promise((resolve, reject) => {
    // __dirname = .../apps/api/src/routes
    // Go up three levels: routes -> src -> api -> apps
    const appsDir = path.resolve(__dirname, '..', '..', '..'); // => .../apps
    const adapterEntry = path.join(
      appsDir,
      'eslint-adapter',
      'dist',
      'adapter.js',
    );

    console.log('internal.ts: appsDir =', appsDir);
    console.log('internal.ts: adapterEntry =', adapterEntry);

    if (!fs.existsSync(adapterEntry)) {
      return reject(
        new Error(
          `ESLint adapter binary not found at ${adapterEntry}. Did you run the build?`,
        ),
      );
    }

    const child = spawn('node', [adapterEntry], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (err) => {
      reject(err);
    });

    child.on('close', (code) => {
      if (code !== 0) {
        const message =
          stderr || `ESLint adapter exited with code ${code ?? 'unknown'}`;
        return reject(new Error(message));
      }

      try {
        const parsed = stdout ? JSON.parse(stdout) : {};
        resolve(parsed);
      } catch (err: any) {
          reject(
            new Error(
              `Failed to parse ESLint adapter output: ${
                err?.message || String(err)
              }`,
            ),
          );
      }
    });

    child.stdin.write(JSON.stringify(input));
    child.stdin.end();
  });
}

// POST /internal/features/:id/run
router.post('/features/:id/run', async (req: Request, res: Response) => {
  try {
    console.log('internal.ts: handler invoked');

    const { id } = req.params;
    const featureId = Number(id);

    if (Number.isNaN(featureId) || featureId <= 0) {
      return res.status(400).json({ error: 'Invalid featureId' });
    }

    const feature = await prisma.features.findUnique({
      where: { id: featureId },
      include: { repositories: true },
    });

    if (!feature) {
      return res.status(404).json({ error: 'Feature not found' });
    }

    if (!feature.repo_id || !feature.repositories) {
      return res.status(400).json({
        error:
          'Feature has no attached repository. Attach a repo before running adapters.',
      });
    }

    const repository = feature.repositories;
    const repositoryId = feature.repo_id;
    const projectId: number | null = null;

    await assertFeatureRepositoryLicenseAllowsExecution(
      featureId,
      repositoryId,
      projectId,
    );

    const repoPath = resolveRepoPath(repository.name);

    if (!fs.existsSync(repoPath)) {
      return res.status(400).json({
        error: 'Repo checkout path does not exist',
        repoPath,
      });
    }

    const adapterInput = {
      repoPath,
      mode: 'platform',
      includePatterns: ['**/*.js', '**/*.ts', '**/*.tsx', '**/*.jsx'],
      excludePatterns: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/.next/**',
      ],
      maxWarnings: 50,
      maxFiles: 200,
    };

    const result = await runEslintAdapter(adapterInput);

    return res.json({
      status: result.status,
      errorCount: result.errorsCount,
      warningCount: result.warningsCount,
      filesAnalyzed: result.filesAnalyzed,
      summary: result.summary,
      rawResults: result.rawResults,
    });
  } catch (error: any) {
    if (error instanceof LicenseExecutionError) {
      return res.status(400).json({ error: error.message });
    }

    logger.error(
      { error: error?.message || String(error) },
      'Feature execution error: internal ESLint feature run failed',
    );
    return res.status(500).json({
      error: 'Failed to execute ESLint feature',
      details: error?.message || String(error),
    });
  }
});

export default router;