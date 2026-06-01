"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchGitHubRepoMetadata = fetchGitHubRepoMetadata;
const logger_1 = require("../logger");
async function fetchGitHubRepoMetadata(owner, repo) {
    const url = `https://api.github.com/repos/${owner}/${repo}`;
    try {
        const response = await fetch(url, {
            headers: {
                Accept: 'application/vnd.github.v3+json',
                'User-Agent': 'ai-feature-platform',
            },
        });
        if (!response.ok) {
            logger_1.logger.warn({ owner, repo, status: response.status }, 'GitHub API request failed');
            return null;
        }
        const data = (await response.json());
        return data;
    }
    catch (error) {
        logger_1.logger.error({ error, owner, repo }, 'Failed to fetch GitHub metadata');
        return null;
    }
}
