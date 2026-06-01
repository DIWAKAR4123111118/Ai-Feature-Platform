import { logger } from '../logger';

interface GitHubRepoData {
  full_name: string;
  html_url: string;
  stargazers_count: number;
  license: { spdx_id: string | null } | null;
  pushed_at: string;
  archived: boolean;
  description: string | null;
}

export async function fetchGitHubRepoMetadata(
  owner: string,
  repo: string,
): Promise<GitHubRepoData | null> {
  const url = `https://api.github.com/repos/${owner}/${repo}`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'ai-feature-platform',
      },
    });

    if (!response.ok) {
      logger.warn(
        { owner, repo, status: response.status },
        'GitHub API request failed',
      );
      return null;
    }

    const data = (await response.json()) as GitHubRepoData;
    return data;
  } catch (error) {
    logger.error({ error, owner, repo }, 'Failed to fetch GitHub metadata');
    return null;
  }
}