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

export async function getFeatures(): Promise<Feature[]> {
  const res = await fetch(`${API_BASE_URL}/features`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch features: ${res.status}`);
  }

  return res.json();
}

export async function createFeature(
  payload: CreateFeaturePayload,
): Promise<Feature> {
  const res = await fetch(`${API_BASE_URL}/features`, {
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
  const res = await fetch(`${API_BASE_URL}/features/${featureId}/repos`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Failed to attach repository: ${res.status} ${text}`,
    );
  }

  return res.json();
}