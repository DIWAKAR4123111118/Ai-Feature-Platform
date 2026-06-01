// apps/api/src/services/eslintRepoScanner.ts
import fs from 'fs';
import path from 'path';
import { prisma } from '../prismaClient';
import { logger } from '../logger';
import { scannerService } from './scanner';
import { executeAdapter } from './adapterExecutor';

export class ESLintRepoScanner {
  /**
   * Scan a repository with the ESLint adapter.
   * For now, runs ESLint on all JS/TS files and logs executions via adapterExecutor.
   */
  async scanRepo(repositoryId: number, adapterName = 'eslint'): Promise<void> {
    const repo = await prisma.repositories.findUnique({
      where: { id: repositoryId },
    });

    if (!repo) {
      throw new Error(`Repository ${repositoryId} not found`);
    }

    if (!repo.github_url) {
      throw new Error(`Repository ${repositoryId} has no github_url`);
    }

    logger.info(
      {
        repositoryId,
        adapter: adapterName,
        githubUrl: repo.github_url,
      },
      'Starting ESLint repo scan',
    );

    // Clone repo into a workspace
    const workspace = await scannerService.cloneRepository(
      repo.github_url,
      repositoryId,
    );

    try {
      // Collect JS/TS files
      const files = this.collectFiles(workspace, [
        '.js',
        '.ts',
        '.jsx',
        '.tsx',
      ]);

      logger.info(
        { repositoryId, adapter: adapterName, fileCount: files.length },
        'Collected files for ESLint scan',
      );

      for (const relPath of files) {
        const absPath = path.join(workspace, relPath);
        const code = fs.readFileSync(absPath, 'utf-8');

        const normalizedPath = relPath.replace(/\\/g, '/');

        const inputPayload = {
          code,
          filePath: normalizedPath,
        };

        const started = Date.now();

        try {
          const result = await executeAdapter({
            repositoryId,
            featureId: null, // batch scan not tied to a specific feature yet
            adapterName,
            filePath: normalizedPath,
            input: inputPayload,
          });

          const duration = Date.now() - started;

          logger.info(
            {
              repositoryId,
              adapter: adapterName,
              filePath: normalizedPath,
              status: result.status,
              duration,
            },
            'ESLint executed successfully on file via adapterExecutor',
          );
        } catch (error: any) {
          const duration = Date.now() - started;

          logger.error(
            {
              repositoryId,
              adapter: adapterName,
              filePath: normalizedPath,
              error: error?.message || String(error),
              duration,
            },
            'ESLint execution failed on file via adapterExecutor',
          );
        }
      }
    } finally {
      // Clean up cloned workspace
      await scannerService.cleanupWorkspace(workspace);
    }
  }

  private collectFiles(root: string, exts: string[]): string[] {
    const out: string[] = [];

    const walk = (dir: string, relativeBase = '') => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relPath = path.join(relativeBase, entry.name);

        if (entry.isDirectory()) {
          walk(fullPath, relPath);
        } else {
          if (exts.includes(path.extname(entry.name))) {
            out.push(relPath.replace(/\\/g, '/'));
          }
        }
      }
    };

    walk(root);
    return out;
  }
}

export const eslintRepoScanner = new ESLintRepoScanner();