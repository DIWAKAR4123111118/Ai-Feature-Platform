// apps/api/src/routes/capabilities.ts
import { Router, Request, Response } from 'express';
import { pool } from '../db';
import { logger } from '../logger';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * GET /capabilities
 * List all approved, license-safe, ESLint-passing capabilities,
 * optionally filtered to those enabled for the current project.
 */
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;

    // projectId is not typed yet on AuthUserPayload; treat as optional bag
    const rawProjectId = (authReq.user as any)?.projectId;
    const projectId =
      rawProjectId != null && !Number.isNaN(Number(rawProjectId))
        ? Number(rawProjectId)
        : null;

    let query = `
      SELECT
        f.id AS feature_id,
        f.name AS feature_name,
        f.description AS feature_description,
        f.status AS feature_status,
        f.approved AS feature_approved,
        r.id AS repository_id,
        r.githuburl AS repository_github_url,
        r.name AS repository_name,
        r.licenserisktier AS license_risk_tier,
        r.licenseaccepted AS license_accepted,
        r.eslintstatus AS eslint_status,
        r.eslinterrorscount AS eslint_errors_count,
        r.securityscore AS security_score,
        r.qualityscore AS quality_score
      FROM features f
      JOIN repositories r ON f.repoid = r.id
    `;

    const params: any[] = [];

    if (projectId) {
      query += `
        JOIN project_features pf ON pf.feature_id = f.id
      `;
    }

    query += `
      WHERE
        f.approved = true
        AND r.licenserisktier IS NOT NULL
        AND r.licenserisktier != 'blocked'
        AND (r.licenserisktier != 'risky' OR r.licenseaccepted = true)
        AND r.eslintstatus = 'pass'
    `;
    // NOTE: later you can align this WHERE with licensePolicy helpers

    if (projectId) {
      params.push(projectId);
      query += `
        AND pf.project_id = $${params.length}
        AND pf.enabled = true
      `;
    }

    query += `
      ORDER BY f.name ASC
    `;

    const result = await pool.query(query, params);

    res.json({ capabilities: result.rows });
  } catch (error: any) {
    logger.error(
      { error: error?.message || String(error) },
      'Failed to list capabilities',
    );
    res.status(500).json({
      error: 'Failed to list capabilities',
      details: error?.message || String(error),
    });
  }
});

/**
 * GET /capabilities/:id
 * Get a single capability by feature id, only if it is approved, license-safe and ESLint-passing,
 * and (if projectId is present) enabled for that project.
 */
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const { id } = authReq.params;
    const featureId = Number(id);

    const rawProjectId = (authReq.user as any)?.projectId;
    const projectId =
      rawProjectId != null && !Number.isNaN(Number(rawProjectId))
        ? Number(rawProjectId)
        : null;

    if (Number.isNaN(featureId) || featureId <= 0) {
      return res.status(400).json({ error: 'Invalid capability id' });
    }

    let query = `
      SELECT
        f.id AS feature_id,
        f.name AS feature_name,
        f.description AS feature_description,
        f.status AS feature_status,
        f.approved AS feature_approved,
        r.id AS repository_id,
        r.githuburl AS repository_github_url,
        r.name AS repository_name,
        r.licenserisktier AS license_risk_tier,
        r.licenseaccepted AS license_accepted,
        r.eslintstatus AS eslint_status,
        r.eslinterrorscount AS eslint_errors_count,
        r.securityscore AS security_score,
        r.qualityscore AS quality_score
      FROM features f
      JOIN repositories r ON f.repoid = r.id
    `;

    const params: any[] = [featureId];

    if (projectId) {
      query += `
        JOIN project_features pf ON pf.feature_id = f.id
      `;
    }

    query += `
      WHERE
        f.id = $1
        AND f.approved = true
        AND r.licenserisktier IS NOT NULL
        AND r.licenserisktier != 'blocked'
        AND (r.licenserisktier != 'risky' OR r.licenseaccepted = true)
        AND r.eslintstatus = 'pass'
    `;

    if (projectId) {
      params.push(projectId);
      query += `
        AND pf.project_id = $${params.length}
        AND pf.enabled = true
      `;
    }

    query += `
      LIMIT 1
    `;

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error:
          'Capability not found or not enabled for this project (or policy not satisfied)',
      });
    }

    res.json({ capability: result.rows[0] });
  } catch (error: any) {
    logger.error(
      { error: error?.message || String(error) },
      'Failed to fetch capability',
    );
    res.status(500).json({
      error: 'Failed to fetch capability',
      details: error?.message || String(error),
    });
  }
});

export default router;