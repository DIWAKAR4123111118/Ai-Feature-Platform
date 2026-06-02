'use client';

import { useState, FormEvent } from 'react';
import type { Feature } from '@/lib/api';
import {
  createFeature,
  attachRepositoryToFeature,
  runEslintScan,
  approveFeature,
  runInternalFeature,
} from '@/lib/api';

interface Props {
  features: Feature[];
}

export default function FeaturesDashboard({ features }: Props) {
  const [featureList, setFeatureList] = useState<Feature[]>(features);
  const [creating, setCreating] = useState(false);
  const [attachLoadingId, setAttachLoadingId] = useState<number | null>(null);
  const [eslintLoadingRepoId, setEslintLoadingRepoId] = useState<number | null>(null);
  const [approveLoadingId, setApproveLoadingId] = useState<number | null>(null);
  const [runLoadingId, setRunLoadingId] = useState<number | null>(null);
  const [runOutput, setRunOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCreateFeature(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setCreating(true);

    const formData = new FormData(e.currentTarget);
    const name = String(formData.get('name') || '').trim();
    const description = String(formData.get('description') || '').trim();

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

  async function handleRunEslint(repoId: number | null) {
    if (!repoId) {
      setError('No repository attached to run ESLint.');
      return;
    }
    setError(null);
    setEslintLoadingRepoId(repoId);

    try {
      const res = await runEslintScan(repoId);

      setFeatureList((prev) =>
        prev.map((f) =>
          f.repositories?.id === repoId
            ? {
                ...f,
                repositories: {
                  ...f.repositories,
                  eslint_status: res.eslintStatus,
                  eslint_errors_count: res.eslintErrorsCount ?? 0,
                },
              }
            : f,
        ),
      );
    } catch (err: any) {
      setError(err.message || 'Failed to run ESLint scan.');
    } finally {
      setEslintLoadingRepoId(null);
    }
  }

  async function handleApproveFeature(featureId: number) {
    setError(null);
    setApproveLoadingId(featureId);

    try {
      const res = await approveFeature(featureId);

      setFeatureList((prev) =>
        prev.map((f) =>
          f.id === featureId ? { ...f, ...res.feature } : f,
        ),
      );
    } catch (err: any) {
      setError(err.message || 'Failed to approve feature.');
    } finally {
      setApproveLoadingId(null);
    }
  }

  async function handleRunFeature(feature: Feature) {
    setError(null);
    setRunOutput(null);
    setRunLoadingId(feature.id);

    try {
      // IMPORTANT: use feature.id, not feature.name
      const res = await runInternalFeature(feature.id, {});

      setRunOutput(
        JSON.stringify(
          {
            feature: feature.name,
            status: res.status,
            output: res.output,
          },
          null,
          2,
        ),
      );
    } catch (err: any) {
      setError(err.message || 'Failed to run feature.');
    } finally {
      setRunLoadingId(null);
    }
  }

  return (
    <main className="space-y-8">
      {error && (
        <div className="rounded border border-red-700 bg-red-950/40 px-4 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      {runOutput && (() => {
        let parsed: any;
        try {
          parsed = JSON.parse(runOutput);
        } catch {
          // Fallback: show raw if somehow not JSON
          return (
            <section className="rounded border border-slate-800 bg-slate-900/60 p-4">
              <h2 className="text-sm font-semibold mb-2">Last feature run output</h2>
              <pre className="max-h-64 overflow-auto rounded bg-slate-950 p-2 text-xs text-slate-200 whitespace-pre-wrap">
                {runOutput}
              </pre>
            </section>
          );
        }

        const out = parsed.output || parsed;

        return (
          <section className="rounded border border-slate-800 bg-slate-900/60 p-4 space-y-3">
            <h2 className="text-sm font-semibold">Last feature run summary</h2>
            <div className="text-xs text-slate-200 space-y-1">
              <div>Status: {out.status}</div>
              <div>Files analyzed: {out.filesAnalyzed}</div>
              <div>Errors: {out.errorsCount}</div>
              <div>Warnings: {out.warningsCount}</div>
            </div>
            <details className="text-xs">
              <summary className="cursor-pointer text-sky-400">Top rules</summary>
              <div className="mt-2 grid grid-cols-2 gap-4">
                <div>
                  <div className="font-semibold text-slate-300 mb-1">Errors</div>
                  <ul className="space-y-0.5">
                    {(out.topErrorRules || []).map((r: any) => (
                      <li key={r.ruleId}>
                        {r.ruleId}: {r.count}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="font-semibold text-slate-300 mb-1">Warnings</div>
                  <ul className="space-y-0.5">
                    {(out.topWarningRules || []).map((r: any) => (
                      <li key={r.ruleId}>
                        {r.ruleId}: {r.count}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </details>
            <details className="text-xs">
              <summary className="cursor-pointer text-sky-400">
                View first {out.rawResults?.length || 0} file results
                {out.rawResultsTruncated ? ' (truncated)' : ''}
              </summary>
              <pre className="mt-2 max-h-64 overflow-auto rounded bg-slate-950 p-2 text-xs text-slate-200 whitespace-pre-wrap">
                {JSON.stringify(out.rawResults, null, 2)}
              </pre>
            </details>
          </section>
        );
      })()}

      <section className="rounded border border-slate-800 bg-slate-900/40 p-4">
        <h2 className="text-lg font-semibold mb-3">Create Feature</h2>
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
              placeholder="Code Summary"
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
              placeholder="Summarize code files"
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
          {featureList.map((feature) => {
            const repo = feature.repositories;
            const eslintStatus = repo?.eslint_status || 'unknown';
            const eslintErrors =
              repo?.eslint_errors_count != null
                ? repo.eslint_errors_count
                : 0;
            const canApprove =
              !!repo && eslintStatus === 'pass' && !feature.approved;

            return (
              <div
                key={feature.id}
                className="rounded border border-slate-800 bg-slate-900/40 p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium flex items-center gap-2">
                      <span>{feature.name}</span>
                      <span className="text-xs uppercase tracking-wide text-slate-400">
                        {feature.status}
                      </span>
                      {feature.approved && (
                        <span className="rounded-full bg-emerald-800/40 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                          APPROVED
                        </span>
                      )}
                    </h3>
                    {feature.description && (
                      <p className="text-xs text-slate-400 mt-1">
                        {feature.description}
                      </p>
                    )}
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-400">
                      <span>
                        Approved: {feature.approved ? 'yes' : 'no'}
                      </span>
                      {repo && (
                        <span>
                          ESLint: {eslintStatus}
                          {eslintStatus === 'pass'
                            ? ''
                            : ` (${eslintErrors} errors)`}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-slate-400">
                    ID: {feature.id}
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">
                      Repository
                    </h4>
                    {repo ? (
                      <div className="text-xs space-y-1">
                        <div>
                          <a
                            href={repo.github_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sky-400 hover:underline"
                          >
                            {repo.name}
                          </a>
                        </div>
                        {repo.description && (
                          <div className="text-slate-300">
                            {repo.description}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-3 text-slate-400">
                          <span>
                            ⭐ {repo.stars ?? 'unknown'}
                          </span>
                          {repo.license_spdx && (
                            <span>📜 {repo.license_spdx}</span>
                          )}
                          {repo.license_risk_tier && (
                            <span>
                              Risk: {repo.license_risk_tier}
                            </span>
                          )}
                          <span>Status: {repo.status}</span>
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
                        placeholder="https://github.com/vercel/next.js"
                        className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs outline-none focus:border-sky-500"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          name="owner"
                          placeholder="vercel"
                          className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs outline-none focus:border-sky-500"
                        />
                        <input
                          name="repo"
                          placeholder="next.js"
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

                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">
                      Actions
                    </h4>
                    <div className="flex flex-col gap-2 text-xs">
                      <button
                        type="button"
                        disabled={!repo || eslintLoadingRepoId === repo?.id}
                        onClick={() =>
                          handleRunEslint(repo?.id ?? null)
                        }
                        className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
                      >
                        {eslintLoadingRepoId === repo?.id
                          ? 'Running ESLint…'
                          : 'Run ESLint'}
                      </button>

                      <button
                        type="button"
                        disabled={!canApprove || approveLoadingId === feature.id}
                        onClick={() => handleApproveFeature(feature.id)}
                        className="rounded bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500 disabled:opacity-60"
                      >
                        {approveLoadingId === feature.id
                          ? 'Approving…'
                          : 'Approve feature'}
                      </button>

                      <button
                        type="button"
                        disabled={!feature.approved || runLoadingId === feature.id}
                        onClick={() => handleRunFeature(feature)}
                        className="rounded bg-fuchsia-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-fuchsia-500 disabled:opacity-60"
                      >
                        {runLoadingId === feature.id
                          ? 'Running…'
                          : 'Run feature'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}