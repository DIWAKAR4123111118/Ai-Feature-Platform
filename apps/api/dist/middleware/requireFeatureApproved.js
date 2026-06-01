"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireFeatureApproved = requireFeatureApproved;
const db_1 = require("../db");
const logger_1 = require("../logger");
function requireFeatureApproved(featureName) {
    return async function (req, res, next) {
        try {
            // Look up feature by name and join repo
            const result = await db_1.pool.query(`
          SELECT
            f.id as feature_id,
            f.name as feature_name,
            f.status as feature_status,
            f.repo_id as feature_repo_id,
            r.id as repo_id,
            r.license_risk_tier,
            r.license_accepted,
            r.eslint_status,
            r.eslint_errors_count
          FROM features f
          JOIN repositories r ON f.repo_id = r.id
          WHERE f.name = $1
          LIMIT 1
        `, [featureName]);
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Feature not found' });
            }
            const row = result.rows[0];
            // Feature status gate
            if (row.feature_status !== 'approved') {
                return res.status(403).json({ error: 'Feature not approved' });
            }
            // License gate
            if (row.license_risk_tier === 'blocked') {
                return res.status(403).json({ error: 'Blocked license' });
            }
            if (row.license_risk_tier === 'risky' && !row.license_accepted) {
                return res.status(403).json({ error: 'Risky license not accepted' });
            }
            // ESLint quality gate
            if (row.eslint_status !== 'pass') {
                return res.status(403).json({ error: 'ESLint status not pass' });
            }
            // OSV/security gate: fetch latest scan
            const scanResult = await db_1.pool.query(`
          SELECT passed
          FROM security_scans
          WHERE repository_id = $1
          ORDER BY created_at DESC
          LIMIT 1
        `, [row.repo_id]);
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
            // Attach to req for downstream usage
            req.feature = {
                id: row.feature_id,
                name: row.feature_name,
                status: row.feature_status,
                repo_id: row.feature_repo_id,
            };
            req.repository = {
                id: row.repo_id,
                license_risk_tier: row.license_risk_tier,
                license_accepted: row.license_accepted,
                eslint_status: row.eslint_status,
                eslint_errors_count: row.eslint_errors_count,
            };
            return next();
        }
        catch (error) {
            logger_1.logger.error({ error }, 'requireFeatureApproved failed');
            return res.status(500).json({ error: 'Feature approval check failed' });
        }
    };
}
