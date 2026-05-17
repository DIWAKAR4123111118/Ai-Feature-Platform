import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '../logger';

const router = Router();
const prisma = new PrismaClient();

// POST /repos/:repoId/scans - Trigger a new scan
router.post('/repos/:repoId/scans', async (req, res) => {
  try {
    const { repoId } = req.params;
    const { scanType, toolName, toolVersion } = req.body;

    if (!scanType || !toolName) {
      return res.status(400).json({ error: 'scanType and toolName are required' });
    }

    // Verify repo exists
    const repo = await prisma.featureRepo.findUnique({
      where: { id: repoId },
    });

    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    const scan = await prisma.scan.create({
      data: {
        featureRepoId: repoId,
        scanType,
        toolName,
        toolVersion: toolVersion || null,
        status: 'pending',
        startedAt: new Date(),
      },
    });

    logger.info({ scanId: scan.id, repoId, scanType }, 'Scan initiated');
    res.status(201).json(scan);
  } catch (error) {
    logger.error({ error }, 'Failed to create scan');
    res.status(500).json({ error: 'Failed to create scan' });
  }
});

// GET /scans/:scanId - Get scan details with findings
router.get('/scans/:scanId', async (req, res) => {
  try {
    const { scanId } = req.params;

    const scan = await prisma.scan.findUnique({
      where: { id: scanId },
      include: {
        findings: true,
        featureRepo: true,
      },
    });

    if (!scan) {
      return res.status(404).json({ error: 'Scan not found' });
    }

    res.json(scan);
  } catch (error) {
    logger.error({ error }, 'Failed to get scan');
    res.status(500).json({ error: 'Failed to get scan' });
  }
});

// PATCH /scans/:scanId - Update scan status
router.patch('/scans/:scanId', async (req, res) => {
  try {
    const { scanId } = req.params;
    const { status, summary } = req.body;

    const updateData: any = {};
    if (status) updateData.status = status;
    if (summary) updateData.summary = summary;
    if (status === 'completed' || status === 'failed') {
      updateData.finishedAt = new Date();
    }

    const scan = await prisma.scan.update({
      where: { id: scanId },
      data: updateData,
    });

    logger.info({ scanId, status }, 'Scan updated');
    res.json(scan);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Scan not found' });
    }
    logger.error({ error }, 'Failed to update scan');
    res.status(500).json({ error: 'Failed to update scan' });
  }
});

// POST /scans/:scanId/findings - Add findings to a scan
router.post('/scans/:scanId/findings', async (req, res) => {
  try {
    const { scanId } = req.params;
    const { findings } = req.body;

    if (!Array.isArray(findings) || findings.length === 0) {
      return res.status(400).json({ error: 'findings array is required' });
    }

    const createdFindings = await Promise.all(
      findings.map((finding: any) =>
        prisma.scanFinding.create({
          data: {
            scanId,
            severity: finding.severity || null,
            title: finding.title,
            packageName: finding.packageName || null,
            affectedVersion: finding.affectedVersion || null,
            fixedVersion: finding.fixedVersion || null,
            advisoryUrl: finding.advisoryUrl || null,
            location: finding.location || null,
            findingHash: finding.findingHash,
          },
        })
      )
    );

    logger.info({ scanId, count: createdFindings.length }, 'Findings added');
    res.status(201).json(createdFindings);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Duplicate finding detected' });
    }
    logger.error({ error }, 'Failed to add findings');
    res.status(500).json({ error: 'Failed to add findings' });
  }
});

export default router;