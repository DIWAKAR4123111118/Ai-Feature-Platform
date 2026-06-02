// apps/api/src/middleware/requireFeatureApproved.ts
import { Request, Response, NextFunction } from 'express';
import { pool } from '../db';
import { logger } from '../logger';

/**
 * Global feature/repository health gate.
 *
 * Ensures for the given featureId:
 * - Feature exists.
 * - Feature is approved (status + approved flag).
 * - Repository license_risk_tier is not blocked.
 * - Repository ESLint status is pass.
 * - Latest security scan (if exists) passed.
 *
 * Does NOT enforce per-project license acceptance; that is handled by licenseGuard.
 */
export function requireFeatureApproved(_capabilityName: string) {
  return async function (req: Request, res: Response, next: NextFunction) {
    try {
      const { featureId } = req.params;
      const featureIdNum = Number(featureId);

      if (Number.isNaN(featureIdNum) || featureIdNum <= 0) {
        return res.status(400).json({ error: 'Invalid featureId' });
      }

      const result = await pool.query(
        `
          SELECT
            f.id             AS feature_id,
            f.name           AS feature_name,
            f.status         AS feature_status,
            f.approved       AS feature_approved,
            f.repo_id        AS feature_repo_id,
            r.id             AS repo_id,
            r.license_risk_tier,
            r.license_accepted,
            r.eslint_status,
            r.eslint_errors_count
          FROM features f
          JOIN repositories r ON f.repo_id = r.id
          WHERE f.id = $1
          LIMIT 1
        `,
        [featureIdNum],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Feature not found' });
      }

      const row = result.rows[0];

      // Feature status gate
      if (row.feature_status !== 'approved' || row.feature_approved !== true) {
        return res.status(403).json({ error: 'Feature not approved' });
      }

      // Global license risk gate (no per-project acceptance here)
      if (row.license_risk_tier === 'blocked') {
        return res.status(403).json({ error: 'Blocked license' });
      }

      // ESLint quality gate
      if (row.eslint_status !== 'pass') {
        return res.status(403).json({ error: 'ESLint status not pass' });
      }

      // OSV/security gate: fetch latest scan by repo_id
      const scanResult = await pool.query(
        `
          SELECT passed
          FROM security_scans
          WHERE repo_id = $1
          ORDER BY scanned_at DESC
          LIMIT 1
        `,
        [row.repo_id],
      );

      if (scanResult.rows.length === 0) {
        return res
          .status(403)
          .json({ error: 'No security scan found for repository' });
      }

      if (!scanResult.rows[0].passed) {
        return res
          .status(403)
          .json({ error: 'Latest security scan did not pass' });
      }

      // Attach to req for downstream usage / logging
      (req as any).feature = {
        id: row.feature_id,
        name: row.feature_name,
        status: row.feature_status,
        repo_id: row.feature_repo_id,
      };
      (req as any).repository = {
        id: row.repo_id,
        license_risk_tier: row.license_risk_tier,
        license_accepted: row.license_accepted,
        eslint_status: row.eslint_status,
        eslint_errors_count: row.eslint_errors_count,
      };

      return next();
    } catch (error: any) {
      logger.error(
        { error: error?.message || String(error) },
        'requireFeatureApproved failed',
      );
      return res.status(500).json({
        error: 'Feature approval check failed',
        details: error?.message || String(error),
      });
    }
  };
}