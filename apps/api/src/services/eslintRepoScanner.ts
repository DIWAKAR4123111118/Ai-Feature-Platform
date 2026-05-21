import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { logger } from '../logger';
import { scannerService } from './scanner';

const prisma = new PrismaClient();

interface LintIssue {
  ruleId: string | null;
  message: string;
  severity: 'error' | 'warning';
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
}

interface LintOutput {
  issues: LintIssue[];
  errorCount: number;
  warningCount: number;
  fixedCode?: string;
}

export class ESLintRepoScanner {
  /**
   * Scan a repository with the ESLint adapter.
   * @param repositoryId ID of the repositories row
   * @param adapterName  name of adapter, e.g. 'eslint'
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

    // 1. Clone repo using existing scannerService
    const workspace = await scannerService.cloneRepository(
      repo.github_url,
      repositoryId,
    );

    try {
      // 2. Collect JS/TS files
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

      // 3. Lint each file through internal ESLint adapter API
      for (const relPath of files) {
        const absPath = path.join(workspace, relPath);
        const code = fs.readFileSync(absPath, 'utf-8');

        const inputPayload = {
          input: {
            code,
            filePath: relPath,
          },
        };

        const started = Date.now();

        try {
          const result = await this.runESLintAdapter(inputPayload);

          const duration = Date.now() - started;

          await prisma.adapter_executions.create({
            data: {
              repository_id: repositoryId,
              adapter_name: adapterName,
              file_path: relPath.replace(/\\/g, '/'),
              input: inputPayload as any,
              output: result as any,
              status: 'success',
              duration,
              error_message: null,
            },
          });

          logger.info(
            {
              repositoryId,
              adapter: adapterName,
              filePath: relPath,
              errorCount: result.errorCount,
              warningCount: result.warningCount,
              duration,
            },
            'ESLint executed successfully on file',
          );
        } catch (error: any) {
          const duration = Date.now() - started;

          await prisma.adapter_executions.create({
            data: {
              repository_id: repositoryId,
              adapter_name: adapterName,
              file_path: relPath.replace(/\\/g, '/'),
              input: inputPayload as any,
              output: null,
              status: 'error',
              duration,
              error_message: error?.message || String(error),
            },
          });

          logger.error(
            {
              repositoryId,
              adapter: adapterName,
              filePath: relPath,
              error: error?.message || String(error),
              duration,
            },
            'ESLint execution failed on file',
          );
        }
      }
    } finally {
      // 4. Clean up cloned workspace
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

  private async runESLintAdapter(
    payload: { input: { code: string; filePath: string } },
  ): Promise<LintOutput> {
    const baseUrl =
      process.env.API_BASE_URL ?? 'http://localhost:3000';
    const token = process.env.INTERNAL_SERVICE_JWT;

    const response = await fetch(
      `${baseUrl}/internal/features/eslint/run`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`ESLint adapter failed: ${response.status} ${text}`);
    }

    return (await response.json()) as LintOutput;
  }
}

export const eslintRepoScanner = new ESLintRepoScanner();