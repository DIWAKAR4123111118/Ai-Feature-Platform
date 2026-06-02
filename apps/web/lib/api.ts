import { getAuthToken } from './auth';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

export interface Repository {
  id: number;
  github_url: string;
  name: string;
  description: string | null;
  stars: number | null;
  language: string | null;
  license_spdx: string | null;
  license_text: string | null;
  license_risk_tier: string | null;
  license_accepted: boolean | null;
  license_accepted_by: string | null;
  license_accepted_at: string | null;
  security_score: number | null;
  quality_score: number | null;
  status: string;
  eslint_status?: string | null;
  eslint_errors_count?: number | null;
  created_at: string;
  updated_at: string;
}

export interface Feature {
  id: number;
  repo_id: number | null;
  name: string;
  version: string | null;
  description: string | null;
  status: string;
  approved: boolean;
  created_at: string;
  updated_at: string;
  repositories: Repository | null;
}

export interface CreateFeaturePayload {
  name: string;
  description?: string;
}

export interface AttachRepoPayload {
  githubUrl: string;
  owner: string;
  repo: string;
}

async function authedFetch(
  input: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = await getAuthToken();

  const headers: HeadersInit = {
    ...(init.headers || {}),
    Authorization: `Bearer ${token}`,
  };

  return fetch(input, {
    ...init,
    headers,
  });
}

/**
 * Fetch all features, including attached repository and its ESLint status.
 */
export async function getFeatures(): Promise<Feature[]> {
  const res = await authedFetch(`${API_BASE_URL}/features`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch features: ${res.status}`);
  }

  const data = await res.json();

  if (Array.isArray(data)) {
    return data as Feature[];
  }
  if (Array.isArray((data as any).features)) {
    return (data as any).features as Feature[];
  }

  throw new Error('Unexpected features response shape');
}

export async function createFeature(
  payload: CreateFeaturePayload,
): Promise<Feature> {
  const res = await authedFetch(`${API_BASE_URL}/features`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create feature: ${res.status} ${text}`);
  }

  return res.json();
}

export async function attachRepositoryToFeature(
  featureId: number,
  payload: AttachRepoPayload,
): Promise<{
  feature: Feature;
  repository: Repository;
  licenseClassification: {
    tier: string;
    reason: string;
  };
}> {
  const res = await authedFetch(
    `${API_BASE_URL}/features/${featureId}/repos`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Failed to attach repository: ${res.status} ${text}`,
    );
  }

  return res.json();
}

/**
 * Run ESLint scan for a repository.
 * Backend: POST /repositories/:id/eslint-scan
 */
export async function runEslintScan(
  repositoryId: number,
): Promise<{
  repositoryId: string;
  eslintStatus: string;
  eslintErrorsCount?: number;
  adapterExecutionId?: string;
}> {
  const res = await authedFetch(
    `${API_BASE_URL}/repositories/${repositoryId}/eslint-scan`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to run ESLint scan: ${res.status} ${text}`);
  }

  return res.json();
}

/**
 * Approve a feature.
 * Backend: POST /features/:id/approve
 */
export async function approveFeature(
  featureId: number,
): Promise<{
  success: boolean;
  message: string;
  feature: Feature;
}> {
  const res = await authedFetch(
    `${API_BASE_URL}/features/${featureId}/approve`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to approve feature: ${res.status} ${text}`);
  }

  return res.json();
}

/**
 * Run an internal feature by ID.
 * Backend: POST /internal/features/:id/run
 */
export async function runInternalFeature(
  featureId: number,
  input: unknown,
): Promise<{
  status: string;
  output: unknown;
  executionId?: string;
}> {
  const res = await authedFetch(
    `${API_BASE_URL}/internal/features/${featureId}/run`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input }),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to run feature: ${res.status} ${text}`);
  }

  return res.json();
}