import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import simpleGit from 'simple-git';
import { logger } from '../logger';

const execAsync = promisify(exec);

const WORKSPACE_DIR = path.join(process.cwd(), 'temp-workspaces');

export interface ScanResult {
  status: 'passed' | 'failed';
  vulnerabilitiesCount: number;
  findings: Array<{
    severity: string;
    title: string;
    packageName: string;
    affectedVersion?: string;
    fixedVersion?: string;
    advisoryUrl?: string;
  }>;
  rawOutput: any;
}

export class ScannerService {
  
  async ensureWorkspaceDir() {
    try {
      await fs.mkdir(WORKSPACE_DIR, { recursive: true });
    } catch (error) {
      logger.error({ error }, 'Failed to create workspace directory');
      throw error;
    }
  }

  async cloneRepository(repoUrl: string, repoId: number): Promise<string> {
    await this.ensureWorkspaceDir();
    
    const repoPath = path.join(WORKSPACE_DIR, `repo-${repoId}-${Date.now()}`);
    
    logger.info({ repoUrl, repoPath }, 'Cloning repository');
    
    try {
      const git = simpleGit();
      await git.clone(repoUrl, repoPath, ['--depth', '1']);
      
      logger.info({ repoPath }, 'Repository cloned successfully');
      return repoPath;
    } catch (error) {
      logger.error({ error, repoUrl }, 'Failed to clone repository');
      throw new Error('Repository clone failed');
    }
  }

  async runOSVScan(repoPath: string): Promise<ScanResult> {
    logger.info({ repoPath }, 'Starting OSV scan with Docker');
    
    // Convert Windows path to Unix-style for Docker
    const normalizedPath = repoPath.replace(/\\/g, '/').replace(/^([A-Z]):/, (match, drive) => {
      return `/${drive.toLowerCase()}`;
    });
    
    try {
      // Run OSV-Scanner via Docker
      const { stdout, stderr } = await execAsync(
        `docker run --rm -v "${normalizedPath}:/src" ghcr.io/google/osv-scanner:latest --format json /src`,
        { 
          timeout: 300000, // 5 minutes max
          maxBuffer: 10 * 1024 * 1024 // 10MB buffer
        }
      );
      
      let rawOutput;
      try {
        rawOutput = JSON.parse(stdout);
      } catch {
        rawOutput = { stdout, stderr };
      }
      
      const findings = this.parseOSVOutput(rawOutput);
      const vulnerabilitiesCount = findings.length;
      const hasCritical = findings.some(f => f.severity === 'CRITICAL' || f.severity === 'HIGH');
      
      logger.info({ vulnerabilitiesCount, hasCritical }, 'OSV scan completed');
      
      return {
        status: hasCritical ? 'failed' : 'passed',
        vulnerabilitiesCount,
        findings,
        rawOutput
      };
      
    } catch (error: any) {
      logger.warn({ error: error.message }, 'OSV scan completed with warnings');
      
      // OSV-Scanner exits with non-zero if vulnerabilities found
      // Parse the output anyway
      let rawOutput;
      try {
        rawOutput = JSON.parse(error.stdout || '{}');
      } catch {
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

  parseOSVOutput(output: any): Array<{
    severity: string;
    title: string;
    packageName: string;
    affectedVersion?: string;
    fixedVersion?: string;
    advisoryUrl?: string;
  }> {
    const findings: Array<any> = [];
    
    if (!output.results) {
      return findings;
    }
    
    for (const result of output.results) {
      if (!result.packages) continue;
      
      for (const pkg of result.packages) {
        if (!pkg.vulnerabilities) continue;
        
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

  async cleanupWorkspace(repoPath: string) {
    try {
      await fs.rm(repoPath, { recursive: true, force: true });
      logger.info({ repoPath }, 'Workspace cleaned up');
    } catch (error) {
      logger.error({ error, repoPath }, 'Failed to cleanup workspace');
    }
  }
}

export const scannerService = new ScannerService();