import { Router } from 'express';
import { pool } from '../db';
import { logger } from '../logger';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { fetchGitHubRepoMetadata } from '../services/github';
import { classifyLicense, getLicenseWarning } from '../services/licenseClassifier';

const router = Router();

// Get all repositories
router.get('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(
      'SELECT id, github_url, name, description, stars, license_spdx, license_risk_tier, license_accepted, security_score, quality_score, status, created_at FROM repositories ORDER BY created_at DESC'
    );

    res.json({ repositories: result.rows });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch repositories');
    res.status(500).json({ error: 'Failed to fetch repositories' });
  }
});

// Create repository
router.post('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { github_url, name, description } = req.body;

    if (!github_url || !name) {
      return res.status(400).json({ error: 'github_url and name are required' });
    }

    // Extract owner/repo from GitHub URL
    const urlMatch = github_url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!urlMatch) {
      return res.status(400).json({ error: 'Invalid GitHub URL format' });
    }

    const [, owner, repo] = urlMatch;

    // Fetch GitHub metadata including license
    let stars = 0;
    let licenseSpdx = null;
    let licenseText = null;

    try {
      const metadata = await fetchGitHubRepoMetadata(owner, repo);
      
      if (metadata) {
        stars = metadata.stargazers_count || 0;
        licenseSpdx = metadata.license?.spdx_id || null;

        // Fetch full license text
        if (licenseSpdx) {
          const licenseResponse = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/license`,
            {
              headers: {
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'AI-Feature-Platform'
              }
            }
          );
          
          if (licenseResponse.ok) {
            const licenseData = await licenseResponse.json();
            licenseText = Buffer.from(licenseData.content, 'base64').toString('utf-8');
          }
        }
      }
    } catch (err) {
      logger.warn({ err, github_url }, 'Failed to fetch GitHub metadata');
    }

    // Classify license
    const licenseClassification = classifyLicense(licenseSpdx);

    // Block if license is not safe or risky
    if (licenseClassification.tier === 'blocked') {
      return res.status(400).json({
        error: 'Repository license is not approved',
        license: licenseSpdx || 'NONE',
        reason: licenseClassification.reason,
        requiresManualReview: true
      });
    }

    const result = await pool.query(
      `INSERT INTO repositories (
        github_url, name, description, stars, 
        license_spdx, license_text, license_risk_tier, license_accepted
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        github_url, 
        name, 
        description, 
        stars,
        licenseSpdx,
        licenseText,
        licenseClassification.tier,
        licenseClassification.tier === 'safe' // Auto-accept safe licenses
      ]
    );

    const repository = result.rows[0];
    const response: any = {
      repository,
      licenseClassification
    };

    // Add warning for risky licenses
    if (licenseClassification.tier === 'risky') {
      response.licenseWarning = getLicenseWarning(licenseSpdx!);
      response.requiresAcceptance = true;
    }

    logger.info({ 
      repoId: repository.id, 
      licenseSpdx, 
      licenseRiskTier: licenseClassification.tier 
    }, 'Repository created with license classification');

    res.status(201).json(response);
  } catch (error: any) {
    logger.error({ error }, 'Failed to create repository');
    if (error.code === '23505') {
      res.status(400).json({ error: 'Repository URL already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create repository' });
    }
  }
});

// Accept risky license
router.post('/:id/accept-license', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    const { acknowledgeRisks } = req.body;

    if (!acknowledgeRisks) {
      return res.status(400).json({
        error: 'You must acknowledge license risks by setting acknowledgeRisks: true'
      });
    }

    // Check if repo exists and is risky
    const repoResult = await pool.query(
      'SELECT license_spdx, license_risk_tier FROM repositories WHERE id = $1',
      [id]
    );

    if (repoResult.rows.length === 0) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    const repo = repoResult.rows[0];

    if (repo.license_risk_tier !== 'risky') {
      return res.status(400).json({
        error: 'This repository does not require license acceptance',
        tier: repo.license_risk_tier
      });
    }

    // Accept the license
    const updateResult = await pool.query(
      `UPDATE repositories 
       SET license_accepted = true, 
           license_accepted_by = $1, 
           license_accepted_at = NOW() 
       WHERE id = $2 
       RETURNING *`,
      [userId?.toString(), id]
    );

    logger.info({ repoId: id, userId, license: repo.license_spdx }, 'Risky license accepted');

    res.json({
      message: 'License risk accepted',
      repository: updateResult.rows[0],
      disclaimer: 'You acknowledge responsibility for compliance with this license.'
    });

  } catch (error) {
    logger.error({ error }, 'Failed to accept license');
    res.status(500).json({ error: 'Failed to accept license' });
  }
});

// Get repository license
router.get('/:id/license', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT license_spdx, license_text, license_risk_tier, github_url FROM repositories WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    const repo = result.rows[0];

    res.json({
      license: repo.license_spdx,
      riskTier: repo.license_risk_tier,
      fullText: repo.license_text,
      sourceUrl: `${repo.github_url}/blob/main/LICENSE`
    });

  } catch (error) {
    logger.error({ error }, 'Failed to fetch license');
    res.status(500).json({ error: 'Failed to fetch license' });
  }
});

// Get single repository
router.get('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query('SELECT * FROM repositories WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    res.json({ repository: result.rows[0] });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch repository');
    res.status(500).json({ error: 'Failed to fetch repository' });
  }
});

export default router;