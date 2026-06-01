import path from 'path';
import fs from 'fs-extra';
import simpleGit from 'simple-git';
import { logger } from '../logger';

const REPO_ROOT =
  process.env.REPO_CHECKOUT_ROOT || 'C:\\ai-feature-platform-repos';

export function getRepoPath(repoId: number): string {
  const p = path.join(REPO_ROOT, String(repoId));
  logger.info({ repoId, REPO_ROOT, path: p }, 'Computed repo path');
  return p;
}

export async function checkoutOrUpdateRepo(repoId: number, githubUrl: string) {
  const targetPath = getRepoPath(repoId);

  await fs.ensureDir(REPO_ROOT);

  const git = simpleGit();

  if (await fs.pathExists(targetPath)) {
    logger.info({ repoId, targetPath }, 'Using existing repo checkout (no pull)');
    return targetPath;
  }

  logger.info({ repoId, githubUrl, targetPath }, 'Cloning repository');
  await git.clone(githubUrl, targetPath);
  return targetPath;
}