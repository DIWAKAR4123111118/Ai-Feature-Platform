"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const logger_1 = require("../logger");
const auth_1 = require("../middleware/auth");
const scanner_1 = require("../services/scanner");
const eslintRepoScanner_1 = require("../services/eslintRepoScanner");
const router = (0, express_1.Router)();
// Trigger OSV scan for a repository
router.post('/repositories/:id/scan', auth_1.authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const idStr = Array.isArray(id) ? id[0] : id;
        // Get repository details
        const repoResult = await db_1.pool.query('SELECT * FROM repositories WHERE id = $1', [idStr]);
        if (repoResult.rows.length === 0) {
            return res.status(404).json({ error: 'Repository not found' });
        }
        const repo = repoResult.rows[0];
        // Create scan record
        const scanRecord = await db_1.pool.query('INSERT INTO security_scans (repo_id, scan_type, vulnerabilities_count, passed) VALUES ($1, $2, $3, $4) RETURNING *', [idStr, 'osv-scanner', 0, false]);
        const scanId = scanRecord.rows[0].id;
        // Start async scan (don't await - run in background)
        performScan(scanId, repo).catch((err) => {
            logger_1.logger.error({ err, scanId }, 'Background scan failed');
        });
        return res.status(202).json({
            message: 'Scan started',
            scanId,
            status: 'running',
        });
    }
    catch (error) {
        logger_1.logger.error({ error }, 'Failed to start scan');
        return res.status(500).json({ error: 'Failed to start scan' });
    }
});
// Get scan results
router.get('/scans/:id', auth_1.authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const idStr = Array.isArray(id) ? id[0] : id;
        const scanResult = await db_1.pool.query('SELECT * FROM security_scans WHERE id = $1', [idStr]);
        if (scanResult.rows.length === 0) {
            return res.status(404).json({ error: 'Scan not found' });
        }
        return res.json({ scan: scanResult.rows[0] });
    }
    catch (error) {
        logger_1.logger.error({ error }, 'Failed to fetch scan');
        return res.status(500).json({ error: 'Failed to fetch scan' });
    }
});
// Background OSV scan execution
async function performScan(scanId, repo) {
    let repoPath = null;
    try {
        logger_1.logger.info({ scanId, repoUrl: repo.github_url }, 'Starting background scan');
        // Clone repository
        repoPath = await scanner_1.scannerService.cloneRepository(repo.github_url, repo.id);
        // Run OSV scan
        const scanResult = await scanner_1.scannerService.runOSVScan(repoPath);
        // Update scan record
        await db_1.pool.query('UPDATE security_scans SET vulnerabilities_count = $1, passed = $2, result = $3 WHERE id = $4', [
            scanResult.vulnerabilitiesCount,
            scanResult.status === 'passed',
            JSON.stringify(scanResult),
            scanId,
        ]);
        logger_1.logger.info({ scanId, status: scanResult.status }, 'Scan completed');
    }
    catch (error) {
        logger_1.logger.error({ error, scanId }, 'Scan execution failed');
        await db_1.pool.query('UPDATE security_scans SET passed = $1, result = $2 WHERE id = $3', [false, JSON.stringify({ error: String(error) }), scanId]);
    }
    finally {
        if (repoPath) {
            await scanner_1.scannerService.cleanupWorkspace(repoPath);
        }
    }
}
// NEW: ESLint repo scan using adapter_executions + ESLint adapter
router.post('/repositories/:id/eslint-scan', auth_1.authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const idStr = Array.isArray(id) ? id[0] : id;
        // Check repo exists (reuse DB via pool)
        const repoResult = await db_1.pool.query('SELECT * FROM repositories WHERE id = $1', [idStr]);
        if (repoResult.rows.length === 0) {
            return res.status(404).json({ error: 'Repository not found' });
        }
        // Fire ESLint repo scan (background)
        const repositoryId = Number(idStr);
        eslintRepoScanner_1.eslintRepoScanner
            .scanRepo(repositoryId, 'eslint')
            .catch((err) => {
            logger_1.logger.error({ err, repositoryId }, 'ESLint repo scan failed in background');
        });
        return res.status(202).json({
            message: 'ESLint repo scan started',
            repositoryId,
            adapter: 'eslint',
        });
    }
    catch (error) {
        logger_1.logger.error({ error }, 'Failed to start ESLint repo scan');
        return res.status(500).json({
            error: 'Failed to start ESLint repo scan',
        });
    }
});
exports.default = router;
