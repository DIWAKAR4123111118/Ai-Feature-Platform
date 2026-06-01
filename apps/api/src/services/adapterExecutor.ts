import fetch from 'node-fetch';
import { prisma } from '../prismaClient';
import { logger } from '../logger';

interface ExecuteAdapterParams {
  repositoryId: number;
  featureId?: number | null;
  adapterName: string;
  filePath?: string | null;
  input: any;
}

interface AdapterExecutionResult {
  id: string;
  status: string;
  duration: number;
  output: any;
  errorMessage: string | null;
}

export class AdapterExecutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdapterExecutionError';
  }
}

export async function executeAdapter(
  params: ExecuteAdapterParams,
): Promise<AdapterExecutionResult> {
  const {
    repositoryId,
    featureId = null,
    adapterName,
    filePath = null,
    input,
  } = params;

  if (adapterName !== 'eslint') {
    throw new AdapterExecutionError(`Unsupported adapter: ${adapterName}`);
  }

  const startedAt = Date.now();

  const execution = await prisma.adapter_executions.create({
    data: {
      repository_id: repositoryId,
      feature_id: featureId,
      adapter_name: adapterName,
      file_path: filePath,
      input,
      output: {},
      status: 'pending',
      duration: 0,
      error_message: null,
      lint_errors: 0,
    },
  });

  let status: string = 'error';
  let output: any = null;
  let errorMessage: string | null = null;
  let lintErrors = 0;

  try {
    const baseUrl = process.env.API_BASE_URL ?? 'http://localhost:3000';
    const token = process.env.INTERNAL_SERVICE_JWT;

    const response = await fetch(`${baseUrl}/internal/features/eslint/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ input }),
    });

    const duration = Date.now() - startedAt;

    if (!response.ok) {
      const text = await response.text();
      status = 'error';
      errorMessage = `ESLint adapter failed: ${response.status} ${text}`;

      await prisma.adapter_executions.update({
        where: { id: execution.id },
        data: {
          status,
          duration,
          error_message: errorMessage,
          output: {},
          lint_errors: 0,
        },
      });

      logger.error(
        {
          executionId: execution.id,
          repositoryId,
          featureId,
          adapterName,
          status,
          duration,
          errorMessage,
        },
        'Adapter execution failed',
      );

      throw new AdapterExecutionError(errorMessage);
    }

    const resultJson: any = await response.json();
    status = 'success';
    output = resultJson;
    lintErrors =
      typeof resultJson.errorCount === 'number' ? resultJson.errorCount : 0;

    await prisma.adapter_executions.update({
      where: { id: execution.id },
      data: {
        status,
        duration,
        output: resultJson as any,
        error_message: null,
        lint_errors: lintErrors,
      },
    });

    logger.info(
      {
        executionId: execution.id,
        repositoryId,
        featureId,
        adapterName,
        status,
        duration,
        lintErrors,
      },
      'Adapter execution succeeded',
    );

    return {
      id: execution.id,
      status,
      duration,
      output,
      errorMessage: null,
    };
  } catch (err: any) {
    const duration = Date.now() - startedAt;

    await prisma.adapter_executions.update({
      where: { id: execution.id },
      data: {
        status: 'error',
        duration,
        error_message: err?.message || String(err),
      },
    });

    logger.error(
      {
        executionId: execution.id,
        repositoryId,
        featureId,
        adapterName,
        error: err?.message || String(err),
        duration,
      },
      'Adapter execution threw',
    );

    throw err;
  }
}