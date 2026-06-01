"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRepoPath = getRepoPath;
exports.checkoutOrUpdateRepo = checkoutOrUpdateRepo;
const path_1 = __importDefault(require("path"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const simple_git_1 = __importDefault(require("simple-git"));
const logger_1 = require("../logger");
const REPO_ROOT = process.env.REPO_CHECKOUT_ROOT || 'C:\\ai-feature-platform-repos';
function getRepoPath(repoId) {
    const p = path_1.default.join(REPO_ROOT, String(repoId));
    logger_1.logger.info({ repoId, REPO_ROOT, path: p }, 'Computed repo path');
    return p;
}
async function checkoutOrUpdateRepo(repoId, githubUrl) {
    const targetPath = getRepoPath(repoId);
    await fs_extra_1.default.ensureDir(REPO_ROOT);
    const git = (0, simple_git_1.default)();
    if (await fs_extra_1.default.pathExists(targetPath)) {
        logger_1.logger.info({ repoId, targetPath }, 'Using existing repo checkout (no pull)');
        return targetPath;
    }
    logger_1.logger.info({ repoId, githubUrl, targetPath }, 'Cloning repository');
    await git.clone(githubUrl, targetPath);
    return targetPath;
}
