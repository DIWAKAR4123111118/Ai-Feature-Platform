// apps/api/src/routes/capabilitiesCatalog.ts
import { Router, Request, Response } from 'express';
import { capabilitiesService } from '../services/capabilitiesService';

const router = Router();

// GET /capabilities
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      status,
      adapterName,
      visibility,
      licenseTier,
      page,
      pageSize,
    } = req.query;

    const result = await capabilitiesService.listCapabilities(
      {
        status: status as string | undefined,
        adapterName: adapterName as string | undefined,
        visibility: visibility as string | undefined,
        licenseTier: licenseTier as string | undefined,
        page: page ? Number(page) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined,
      },
      { tenantId: null, projectId: null },
    );

    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({
      error: 'Failed to list capabilities',
      details: err?.message || String(err),
    });
  }
});

// GET /capabilities/:slug
router.get('/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const capability = await capabilitiesService.getCapabilityBySlug(slug, {
      tenantId: null,
      projectId: null,
    });

    if (!capability) {
      return res.status(404).json({ error: 'Capability not found or not visible' });
    }

    return res.json({
      id: capability.id,
      slug: capability.slug,
      name: capability.name,
      description: capability.description,
      status: capability.status,
      visibility: capability.visibility,
      licenseTier: capability.license_tier,
      securitySummary: capability.security_summary,
      qualitySummary: capability.quality_summary,
      adapterName: capability.adapter_name,
      repositoryId: capability.repository_id,
      featureId: capability.feature_id,
      contract: {
        inputDescription: 'Capability-specific JSON input',
        outputDescription: 'Capability-specific JSON output',
      },
      feature: capability.feature,
      repository: capability.repository,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: 'Failed to fetch capability',
      details: err?.message || String(err),
    });
  }
});

export default router;