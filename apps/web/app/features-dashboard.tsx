'use client';

import { useState, FormEvent } from 'react';
import type { Feature } from '@/lib/api';
import {
  createFeature,
  attachRepositoryToFeature,
} from '@/lib/api';

interface Props {
  features: Feature[];
}

export default function FeaturesDashboard({ features }: Props) {
  const [featureList, setFeatureList] = useState<Feature[]>(features);
  const [creating, setCreating] = useState(false);
  const [attachLoadingId, setAttachLoadingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCreateFeature(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setCreating(true);

    const formData = new FormData(e.currentTarget);
    const name = String(formData.get('name') || '').trim();
    const description = String(
      formData.get('description') || '',
    ).trim();

    if (!name) {
      setError('Feature name is required.');
      setCreating(false);
      return;
    }

    try {
      const created = await createFeature({ name, description });
      setFeatureList((prev) => [...prev, created]);
      e.currentTarget.reset();
    } catch (err: any) {
      setError(err.message || 'Failed to create feature.');
    } finally {
      setCreating(false);
    }
  }

  async function handleAttachRepo(
    e: FormEvent<HTMLFormElement>,
    featureId: number,
  ) {
    e.preventDefault();
    setError(null);
    setAttachLoadingId(featureId);

    const formData = new FormData(e.currentTarget);
    const githubUrl = String(formData.get('githubUrl') || '').trim();
    const owner = String(formData.get('owner') || '').trim();
    const repo = String(formData.get('repo') || '').trim();

    if (!githubUrl || !owner || !repo) {
      setError('githubUrl, owner, and repo are required.');
      setAttachLoadingId(null);
      return;
    }

    try {
      const result = await attachRepositoryToFeature(featureId, {
        githubUrl,
        owner,
        repo,
      });

      setFeatureList((prev) =>
        prev.map((f) =>
          f.id === featureId
            ? {
                ...result.feature,
                repositories: result.repository,
              }
            : f,
        ),
      );

      e.currentTarget.reset();
    } catch (err: any) {
      setError(err.message || 'Failed to attach repository.');
    } finally {
      setAttachLoadingId(null);
    }
  }

  return (
    <main className="space-y-8">
      {error && (
        <div className="rounded border border-red-700 bg-red-950/40 px-4 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      <section className="rounded border border-slate-800 bg-slate-900/40 p-4">
        <h2 className="text-lg font-semibold mb-3">
          Create Feature
        </h2>
        <form
          onSubmit={handleCreateFeature}
          className="space-y-3 max-w-md"
        >
          <div className="space-y-1">
            <label
              htmlFor="name"
              className="block text-sm text-slate-300"
            >
              Name
            </label>
            <input
              id="name"
              name="name"
              className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm outline-none focus:border-sky-500"
              placeholder="eslint-feature"
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="description"
              className="block text-sm text-slate-300"
            >
              Description
            </label>
            <input
              id="description"
              name="description"
              className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm outline-none focus:border-sky-500"
              placeholder="ESLint analysis"
            />
          </div>

          <button
            type="submit"
            disabled={creating}
            className="rounded bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-60"
          >
            {creating ? 'Creating…' : 'Create feature'}
          </button>
        </form>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Features</h2>

        {featureList.length === 0 && (
          <p className="text-sm text-slate-400">
            No features yet. Create one above.
          </p>
        )}

        <div className="space-y-4">
          {featureList.map((feature) => (
            <div
              key={feature.id}
              className="rounded border border-slate-800 bg-slate-900/40 p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">
                    {feature.name}{' '}
                    <span className="ml-2 text-xs uppercase tracking-wide text-slate-400">
                      {feature.status}
                    </span>
                  </h3>
                  {feature.description && (
                    <p className="text-xs text-slate-400 mt-1">
                      {feature.description}
                    </p>
                  )}
                </div>
                <div className="text-xs text-slate-400">
                  ID: {feature.id}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">
                    Repository
                  </h4>
                  {feature.repositories ? (
                    <div className="text-xs space-y-1">
                      <div>
                        <a
                          href={feature.repositories.github_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sky-400 hover:underline"
                        >
                          {feature.repositories.name}
                        </a>
                      </div>
                      {feature.repositories.description && (
                        <div className="text-slate-300">
                          {feature.repositories.description}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-3 text-slate-400">
                        <span>
                          ⭐{' '}
                          {feature.repositories.stars ??
                            'unknown'}
                        </span>
                        {feature.repositories.license_spdx && (
                          <span>
                            📜 {feature.repositories.license_spdx}
                          </span>
                        )}
                        {feature.repositories.license_risk_tier && (
                          <span>
                            Risk:{' '}
                            {feature.repositories.license_risk_tier}
                          </span>
                        )}
                        <span>Status: {feature.repositories.status}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">
                      No repository attached yet.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">
                    Attach GitHub Repository
                  </h4>
                  <form
                    onSubmit={(e) =>
                      handleAttachRepo(e, feature.id)
                    }
                    className="space-y-2"
                  >
                    <input
                      name="githubUrl"
                      placeholder="https://github.com/eslint/eslint"
                      className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs outline-none focus:border-sky-500"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        name="owner"
                        placeholder="eslint"
                        className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs outline-none focus:border-sky-500"
                      />
                      <input
                        name="repo"
                        placeholder="eslint"
                        className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs outline-none focus:border-sky-500"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={attachLoadingId === feature.id}
                      className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
                    >
                      {attachLoadingId === feature.id
                        ? 'Attaching…'
                        : 'Attach repo'}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}