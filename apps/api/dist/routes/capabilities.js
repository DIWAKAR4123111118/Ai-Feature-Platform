"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// apps/api/src/routes/capabilities.ts
const express_1 = require("express");
const db_1 = require("../db");
const logger_1 = require("../logger");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
/**
 * GET /capabilities
 * List approved, license- and quality-safe capabilities.
 * If projectId present, restrict to features enabled for that project and
 * risky licenses accepted for that project via project_repo_licenses.
 */
router.get('/', auth_1.authMiddleware, async (req, res) => {
    try {
        const authReq = req;
        const rawProjectId = authReq.user?.projectId;
        const projectId = rawProjectId != null && !Number.isNaN(Number(rawProjectId))
            ? Number(rawProjectId)
            : null;
        const params = [];
        let query = `
      SELECT
        f.id AS feature_id,
        f.name AS feature_name,
        f.description AS feature_description,
        f.status AS feature_status,
        f.approved AS feature_approved,
        r.id AS repository_id,
        r.github_url AS repository_github_url,
        r.name AS repository_name,
        r.license_risk_tier AS license_risk_tier,
        r.license_accepted AS license_accepted_global,
        r.eslint_status AS eslint_status,
        r.eslint_errors_count AS eslint_errors_count,
        r.security_score AS security_score,
        r.quality_score AS quality_score,
        prl.accepted AS project_license_accepted
      FROM features f
      JOIN repositories r ON f.repo_id = r.id
      LEFT JOIN project_features pf
        ON pf.feature_id = f.id
      LEFT JOIN project_repo_licenses prl
        ON prl.repository_id = r.id
    `;
        if (projectId) {
            params.push(projectId, projectId);
            query += `
        AND pf.project_id = $1
        AND prl.project_id = $2
      `;
        }
        query += `
      WHERE
        f.approved = true
        AND r.license_risk_tier IS NOT NULL
        AND r.license_risk_tier != 'blocked'
        AND r.eslint_status = 'pass'
    `;
        if (projectId) {
            query += `
        AND pf.enabled = true
        AND (
          r.license_risk_tier != 'risky'
          OR prl.accepted = true
        )
      `;
        }
        else {
            // No project context: fall back to global acceptance for risky
            query += `
        AND (
          r.license_risk_tier != 'risky'
          OR r.license_accepted = true
        )
      `;
        }
        query += `
      ORDER BY f.name ASC
    `;
        const result = await db_1.pool.query(query, params);
        res.json({ capabilities: result.rows });
    }
    catch (error) {
        logger_1.logger.error({ error: error?.message || String(error) }, 'Failed to list capabilities');
        res.status(500).json({
            error: 'Failed to list capabilities',
            details: error?.message || String(error),
        });
    }
});
/**
 * GET /capabilities/:id
 * Same rules, but for a specific feature id.
 */
router.get('/:id', auth_1.authMiddleware, async (req, res) => {
    try {
        const authReq = req;
        const { id } = authReq.params;
        const featureId = Number(id);
        const rawProjectId = authReq.user?.projectId;
        const projectId = rawProjectId != null && !Number.isNaN(Number(rawProjectId))
            ? Number(rawProjectId)
            : null;
        if (Number.isNaN(featureId) || featureId <= 0) {
            return res.status(400).json({ error: 'Invalid capability id' });
        }
        const params = [featureId];
        let query = `
      SELECT
        f.id AS feature_id,
        f.name AS feature_name,
        f.description AS feature_description,
        f.status AS feature_status,
        f.approved AS feature_approved,
        r.id AS repository_id,
        r.github_url AS repository_github_url,
        r.name AS repository_name,
        r.license_risk_tier AS license_risk_tier,
        r.license_accepted AS license_accepted_global,
        r.eslint_status AS eslint_status,
        r.eslint_errors_count AS eslint_errors_count,
        r.security_score AS security_score,
        r.quality_score AS quality_score,
        prl.accepted AS project_license_accepted
      FROM features f
      JOIN repositories r ON f.repo_id = r.id
      LEFT JOIN project_features pf
        ON pf.feature_id = f.id
      LEFT JOIN project_repo_licenses prl
        ON prl.repository_id = r.id
    `;
        if (projectId) {
            params.push(projectId, projectId);
            query += `
        AND pf.project_id = $2
        AND prl.project_id = $3
      `;
        }
        query += `
      WHERE
        f.id = $1
        AND f.approved = true
        AND r.license_risk_tier IS NOT NULL
        AND r.license_risk_tier != 'blocked'
        AND r.eslint_status = 'pass'
    `;
        if (projectId) {
            query += `
        AND pf.enabled = true
        AND (
          r.license_risk_tier != 'risky'
          OR prl.accepted = true
        )
      `;
        }
        else {
            query += `
        AND (
          r.license_risk_tier != 'risky'
          OR r.license_accepted = true
        )
      `;
        }
        query += `
      LIMIT 1
    `;
        const result = await db_1.pool.query(query, params);
        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Capability not found or not enabled for this project (or policy not satisfied)',
            });
        }
        res.json({ capability: result.rows[0] });
    }
    catch (error) {
        logger_1.logger.error({ error: error?.message || String(error) }, 'Failed to fetch capability');
        res.status(500).json({
            error: 'Failed to fetch capability',
            details: error?.message || String(error),
        });
    }
});
exports.default = router;
