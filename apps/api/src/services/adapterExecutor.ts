import { pool } from '../db';
import { logger } from '../logger';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

interface AdapterExecutionInput {
  repositoryId: number;
  adapterName: string;
  filePath?: string;
  input: Record<string, any>;
}

interface AdapterExecutionResult {
  id: string;
  output: any;
  status: 'success' | 'failure';
  duration: number;
  errorMessage?: string;
}

export async function executeAdapter(
  params: AdapterExecutionInput
): Promise<AdapterExecutionResult> {
  const startTime = Date.now();
  const executionId = generateUUID();

  try {
    let output: any;
    let status: 'success' | 'failure' = 'success';
    let errorMessage: string | undefined;

    // Route to correct adapter
    switch (params.adapterName) {
      case 'eslint':
        output = await runESLintAdapter(params.input);
        break;
      case 'prettier':
        output = await runPrettierAdapter(params.input);
        break;
      default:
        throw new Error(`Unknown adapter: ${params.adapterName}`);
    }

    const duration = Date.now() - startTime;

    // Log to database
    await pool.query(
      `INSERT INTO adapter_executions 
       (id, repository_id, adapter_name, file_path, input, output, status, duration, executed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        executionId,
        params.repositoryId,
        params.adapterName,
        params.filePath,
        JSON.stringify(params.input),
        JSON.stringify(output),
        status,
        duration
      ]
    );

    logger.info({
      executionId,
      adapterName: params.adapterName,
      duration,
      status
    }, 'Adapter executed successfully');

    return { id: executionId, output, status, duration };

  } catch (error: any) {
    const duration = Date.now() - startTime;
    const errorMessage = error.message || 'Unknown error';

    await pool.query(
      `INSERT INTO adapter_executions 
       (id, repository_id, adapter_name, file_path, input, status, duration, error_message, executed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        executionId,
        params.repositoryId,
        params.adapterName,
        params.filePath,
        JSON.stringify(params.input),
        'failure',
        duration,
        errorMessage
      ]
    );

    logger.error({
      executionId,
      adapterName: params.adapterName,
      error: errorMessage
    }, 'Adapter execution failed');

    return { id: executionId, output: null, status: 'failure', duration, errorMessage };
  }
}

async function runESLintAdapter(input: Record<string, any>): Promise<any> {
  const { repoPath, files } = input;

  if (!repoPath) {
    throw new Error('repoPath is required for ESLint adapter');
  }

  const filesToLint = files || ['.'];
  const command = `npx eslint ${filesToLint.join(' ')} --format json`;

  try {
    const { stdout } = await execAsync(command, { cwd: repoPath });
    const results = JSON.parse(stdout);

    const totalErrors = results.reduce((sum: number, r: any) => sum + r.errorCount, 0);
    const totalWarnings = results.reduce((sum: number, r: any) => sum + r.warningCount, 0);

    return {
      totalFiles: results.length,
      totalErrors,
      totalWarnings,
      results
    };
  } catch (error: any) {
    if (error.stdout) {
      const results = JSON.parse(error.stdout);
      const totalErrors = results.reduce((sum: number, r: any) => sum + r.errorCount, 0);
      const totalWarnings = results.reduce((sum: number, r: any) => sum + r.warningCount, 0);

      return {
        totalFiles: results.length,
        totalErrors,
        totalWarnings,
        results
      };
    }
    throw error;
  }
}

async function runPrettierAdapter(input: Record<string, any>): Promise<any> {
  const { repoPath, files } = input;

  if (!repoPath) {
    throw new Error('repoPath is required for Prettier adapter');
  }

  const filesToCheck = files || ['**/*.{js,ts,jsx,tsx,json,css,md}'];
  const command = `npx prettier --check ${filesToCheck.join(' ')}`;

  try {
    await execAsync(command, { cwd: repoPath });
    return { formatted: true, filesNeedingFormat: [] };
  } catch (error: any) {
    const unformattedFiles = error.stdout?.split('\n').filter((line: string) => line.trim());
    return {
      formatted: false,
      filesNeedingFormat: unformattedFiles || []
    };
  }
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}