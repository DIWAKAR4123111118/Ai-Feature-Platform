import axios from 'axios';

const INTERNAL_JWT = process.env.INTERNAL_SERVICE_JWT;
const INTERNAL_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000';

export interface ESLintRunPayload {
  repositoryId: number;
  filePath: string;
  workspacePath: string;
  featureId?: number;
}

export async function runESLintAdapterOnFile(payload: ESLintRunPayload) {
  const res = await axios.post(
    `${INTERNAL_BASE_URL}/internal/features/eslint/run`,
    payload,
    {
      headers: {
        'Content-Type': 'application/json',
        ...(INTERNAL_JWT
          ? { Authorization: `Bearer ${INTERNAL_JWT}` }
          : {}),
      },
    },
  );

  return res.data;
}