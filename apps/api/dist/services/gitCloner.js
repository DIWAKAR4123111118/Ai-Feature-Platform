"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.cloneRepository = cloneRepository;
exports.cleanupClone = cleanupClone;
exports.getRepoFiles = getRepoFiles;
const child_process_1 = require("child_process");
const util_1 = require("util");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const logger_1 = require("../logger");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
async function cloneRepository(githubUrl) {
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
    }
    catch { }
    logger_1.logger.info({ githubUrl, cloneDir }, 'Cloning repository');
    try {
        await execAsync(`git clone --depth 1 ${githubUrl} "${cloneDir}"`);
        logger_1.logger.info({ cloneDir }, 'Repository cloned successfully');
        return cloneDir;
    }
    catch (error) {
        logger_1.logger.error({ error, githubUrl }, 'Failed to clone repository');
        throw new Error(`Failed to clone repository: ${error.message}`);
    }
}
async function cleanupClone(cloneDir) {
    try {
        await fs.rm(cloneDir, { recursive: true, force: true });
        logger_1.logger.info({ cloneDir }, 'Cleaned up cloned directory');
    }
    catch (error) {
        logger_1.logger.warn({ error, cloneDir }, 'Failed to cleanup cloned directory');
    }
}
async function getRepoFiles(dir, maxDepth = 3, currentDepth = 0) {
    if (currentDepth > maxDepth)
        return [];
    const files = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.name === 'node_modules' ||
            entry.name === '.git' ||
            entry.name === 'dist' ||
            entry.name === 'build' ||
            entry.name === 'coverage' ||
            entry.name === '.turbo' ||
            entry.name === '.next' ||
            entry.name === 'test' ||
            entry.name === 'tests' ||
            entry.name === '__tests__') {
            continue;
        }
        if (entry.isDirectory()) {
            const subFiles = await getRepoFiles(fullPath, maxDepth, currentDepth + 1);
            files.push(...subFiles);
        }
        else if (entry.isFile() && isCodeFile(entry.name)) {
            files.push(path.relative(dir, fullPath));
        }
    }
    return files;
}
function isCodeFile(filename) {
    const codeExtensions = ['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs', '.json'];
    return codeExtensions.some((ext) => filename.endsWith(ext));
}
