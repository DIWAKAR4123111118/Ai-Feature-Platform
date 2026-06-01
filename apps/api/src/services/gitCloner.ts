import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../logger';

const execAsync = promisify(exec);

export async function cloneRepository(githubUrl: string): Promise<string> {
  const tempDir = path.join(process.cwd(), 'temp-clones');
  await fs.mkdir(tempDir, { recursive: true });

  const urlMatch = githubUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!urlMatch) {
    throw new Error('Invalid GitHub URL format');
  }

  const [, owner, repo] = urlMatch;
  const cloneDir = path.join(tempDir, `${owner}-${repo}`);

  try {
    await fs.rm(cloneDir, { recursive: true, force: true });
  } catch {}

  logger.info({ githubUrl, cloneDir }, 'Cloning repository');

  try {
    await execAsync(`git clone --depth 1 ${githubUrl} "${cloneDir}"`);
    logger.info({ cloneDir }, 'Repository cloned successfully');
    return cloneDir;
  } catch (error: any) {
    logger.error({ error, githubUrl }, 'Failed to clone repository');
    throw new Error(`Failed to clone repository: ${error.message}`);
  }
}

export async function cleanupClone(cloneDir: string): Promise<void> {
  try {
    await fs.rm(cloneDir, { recursive: true, force: true });
    logger.info({ cloneDir }, 'Cleaned up cloned directory');
  } catch (error: any) {
    logger.warn({ error, cloneDir }, 'Failed to cleanup cloned directory');
  }
}

export async function getRepoFiles(
  dir: string,
  maxDepth = 3,
  currentDepth = 0,
): Promise<string[]> {
  if (currentDepth > maxDepth) return [];

  const files: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (
      entry.name === 'node_modules' ||
      entry.name === '.git' ||
      entry.name === 'dist' ||
      entry.name === 'build' ||
      entry.name === 'coverage' ||
      entry.name === '.turbo' ||
      entry.name === '.next' ||
      entry.name === 'test' ||
      entry.name === 'tests' ||
      entry.name === '__tests__'
    ) {
      continue;
    }

    if (entry.isDirectory()) {
      const subFiles = await getRepoFiles(fullPath, maxDepth, currentDepth + 1);
      files.push(...subFiles);
    } else if (entry.isFile() && isCodeFile(entry.name)) {
      files.push(path.relative(dir, fullPath));
    }
  }

  return files;
}

function isCodeFile(filename: string): boolean {
  const codeExtensions = ['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs', '.json'];
  return codeExtensions.some((ext) => filename.endsWith(ext));
}