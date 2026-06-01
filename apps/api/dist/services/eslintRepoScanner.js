"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.eslintRepoScanner = exports.ESLintRepoScanner = void 0;
// apps/api/src/services/eslintRepoScanner.ts
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const prismaClient_1 = require("../prismaClient");
const logger_1 = require("../logger");
const scanner_1 = require("./scanner");
const adapterExecutor_1 = require("./adapterExecutor");
class ESLintRepoScanner {
    /**
     * Scan a repository with the ESLint adapter.
     * For now, runs ESLint on all JS/TS files and logs executions via adapterExecutor.
     */
    async scanRepo(repositoryId, adapterName = 'eslint') {
        const repo = await prismaClient_1.prisma.repositories.findUnique({
            where: { id: repositoryId },
        });
        if (!repo) {
            throw new Error(`Repository ${repositoryId} not found`);
        }
        if (!repo.github_url) {
            throw new Error(`Repository ${repositoryId} has no github_url`);
        }
        logger_1.logger.info({
            repositoryId,
            adapter: adapterName,
            githubUrl: repo.github_url,
        }, 'Starting ESLint repo scan');
        // Clone repo into a workspace
        const workspace = await scanner_1.scannerService.cloneRepository(repo.github_url, repositoryId);
        try {
            // Collect JS/TS files
            const files = this.collectFiles(workspace, [
                '.js',
                '.ts',
                '.jsx',
                '.tsx',
            ]);
            logger_1.logger.info({ repositoryId, adapter: adapterName, fileCount: files.length }, 'Collected files for ESLint scan');
            for (const relPath of files) {
                const absPath = path_1.default.join(workspace, relPath);
                const code = fs_1.default.readFileSync(absPath, 'utf-8');
                const normalizedPath = relPath.replace(/\\/g, '/');
                const inputPayload = {
                    code,
                    filePath: normalizedPath,
                };
                const started = Date.now();
                try {
                    const result = await (0, adapterExecutor_1.executeAdapter)({
                        repositoryId,
                        featureId: null, // batch scan not tied to a specific feature yet
                        adapterName,
                        filePath: normalizedPath,
                        input: inputPayload,
                    });
                    const duration = Date.now() - started;
                    logger_1.logger.info({
                        repositoryId,
                        adapter: adapterName,
                        filePath: normalizedPath,
                        status: result.status,
                        duration,
                    }, 'ESLint executed successfully on file via adapterExecutor');
                }
                catch (error) {
                    const duration = Date.now() - started;
                    logger_1.logger.error({
                        repositoryId,
                        adapter: adapterName,
                        filePath: normalizedPath,
                        error: error?.message || String(error),
                        duration,
                    }, 'ESLint execution failed on file via adapterExecutor');
                }
            }
        }
        finally {
            // Clean up cloned workspace
            await scanner_1.scannerService.cleanupWorkspace(workspace);
        }
    }
    collectFiles(root, exts) {
        const out = [];
        const walk = (dir, relativeBase = '') => {
            const entries = fs_1.default.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path_1.default.join(dir, entry.name);
                const relPath = path_1.default.join(relativeBase, entry.name);
                if (entry.isDirectory()) {
                    walk(fullPath, relPath);
                }
                else {
                    if (exts.includes(path_1.default.extname(entry.name))) {
                        out.push(relPath.replace(/\\/g, '/'));
                    }
                }
            }
        };
        walk(root);
        return out;
    }
}
exports.ESLintRepoScanner = ESLintRepoScanner;
exports.eslintRepoScanner = new ESLintRepoScanner();
