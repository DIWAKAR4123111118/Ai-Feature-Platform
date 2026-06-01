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
 * List all approved, license-safe, ESLint-passing capabilities,
 * optionally filtered to those enabled for the current project.
 */
router.get('/', auth_1.authMiddleware, async (req, res) => {
    try {
        const authReq = req;
        // projectId is not typed yet on AuthUserPayload; treat as optional bag
        const rawProjectId = authReq.user?.projectId;
        const projectId = rawProjectId != null && !Number.isNaN(Number(rawProjectId))
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
        const params = [];
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
 * Get a single capability by feature id, only if it is approved, license-safe and ESLint-passing,
 * and (if projectId is present) enabled for that project.
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
        const params = [featureId];
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
