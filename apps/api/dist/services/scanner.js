"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scannerService = exports.ScannerService = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const simple_git_1 = __importDefault(require("simple-git"));
const logger_1 = require("../logger");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
const WORKSPACE_DIR = path_1.default.join(process.cwd(), 'temp-workspaces');
class ScannerService {
    async ensureWorkspaceDir() {
        try {
            await promises_1.default.mkdir(WORKSPACE_DIR, { recursive: true });
        }
        catch (error) {
            logger_1.logger.error({ error }, 'Failed to create workspace directory');
            throw error;
        }
    }
    async cloneRepository(repoUrl, repoId) {
        await this.ensureWorkspaceDir();
        const repoPath = path_1.default.join(WORKSPACE_DIR, `repo-${repoId}-${Date.now()}`);
        logger_1.logger.info({ repoUrl, repoPath }, 'Cloning repository');
        try {
            const git = (0, simple_git_1.default)();
            await git.clone(repoUrl, repoPath, ['--depth', '1']);
            logger_1.logger.info({ repoPath }, 'Repository cloned successfully');
            return repoPath;
        }
        catch (error) {
            logger_1.logger.error({ error, repoUrl }, 'Failed to clone repository');
            throw new Error('Repository clone failed');
        }
    }
    async runOSVScan(repoPath) {
        logger_1.logger.info({ repoPath }, 'Starting OSV scan with Docker');
        // Convert Windows path to Unix-style for Docker
        const normalizedPath = repoPath.replace(/\\/g, '/').replace(/^([A-Z]):/, (match, drive) => {
            return `/${drive.toLowerCase()}`;
        });
        try {
            // Run OSV-Scanner via Docker
            const { stdout, stderr } = await execAsync(`docker run --rm -v "${normalizedPath}:/src" ghcr.io/google/osv-scanner:latest --format json /src`, {
                timeout: 300000, // 5 minutes max
                maxBuffer: 10 * 1024 * 1024 // 10MB buffer
            });
            let rawOutput;
            try {
                rawOutput = JSON.parse(stdout);
            }
            catch {
                rawOutput = { stdout, stderr };
            }
            const findings = this.parseOSVOutput(rawOutput);
            const vulnerabilitiesCount = findings.length;
            const hasCritical = findings.some(f => f.severity === 'CRITICAL' || f.severity === 'HIGH');
            logger_1.logger.info({ vulnerabilitiesCount, hasCritical }, 'OSV scan completed');
            return {
                status: hasCritical ? 'failed' : 'passed',
                vulnerabilitiesCount,
                findings,
                rawOutput
            };
        }
        catch (error) {
            logger_1.logger.warn({ error: error.message }, 'OSV scan completed with warnings');
            // OSV-Scanner exits with non-zero if vulnerabilities found
            // Parse the output anyway
            let rawOutput;
            try {
                rawOutput = JSON.parse(error.stdout || '{}');
            }
            catch {
                rawOutput = { stdout: error.stdout, stderr: error.stderr };
            }
            const findings = this.parseOSVOutput(rawOutput);
            const vulnerabilitiesCount = findings.length;
            return {
                status: vulnerabilitiesCount > 0 ? 'failed' : 'passed',
                vulnerabilitiesCount,
                findings,
                rawOutput
            };
        }
    }
    parseOSVOutput(output) {
        const findings = [];
        if (!output.results) {
            return findings;
        }
        for (const result of output.results) {
            if (!result.packages)
                continue;
            for (const pkg of result.packages) {
                if (!pkg.vulnerabilities)
                    continue;
                for (const vuln of pkg.vulnerabilities) {
                    findings.push({
                        severity: vuln.severity?.[0] || 'UNKNOWN',
                        title: vuln.summary || vuln.id || 'Unknown vulnerability',
                        packageName: pkg.package?.name || 'unknown',
                        affectedVersion: pkg.package?.version,
                        fixedVersion: vuln.fixed,
                        advisoryUrl: vuln.database_specific?.url || `https://osv.dev/vulnerability/${vuln.id}`
                    });
                }
            }
        }
        return findings;
    }
    async cleanupWorkspace(repoPath) {
        try {
            await promises_1.default.rm(repoPath, { recursive: true, force: true });
            logger_1.logger.info({ repoPath }, 'Workspace cleaned up');
        }
        catch (error) {
            logger_1.logger.error({ error, repoPath }, 'Failed to cleanup workspace');
        }
    }
}
exports.ScannerService = ScannerService;
exports.scannerService = new ScannerService();
