import { prisma } from '../prismaClient';

export interface TenantContext {
  tenantId: number | null;
  projectId: number | null;
}

export interface CapabilityFilters {
  status?: string;
  adapterName?: string;
  visibility?: string;
  licenseTier?: string;
  page?: number;
  pageSize?: number;
}

const MAX_PAGE_SIZE = 100;

export const capabilitiesService = {
  async listCapabilities(filters: CapabilityFilters, ctx: TenantContext) {
    const {
      status,
      adapterName,
      visibility,
      licenseTier,
      page = 1,
      pageSize = 20,
    } = filters;

    const take = Math.min(pageSize, MAX_PAGE_SIZE);
    const skip = (page - 1) * take;

    const where: any = {};

    if (status) where.status = status;
    if (adapterName) where.adapter_name = adapterName;
    if (visibility) where.visibility = visibility;

    // Hide blocked by default
    if (licenseTier) {
      where.license_tier = licenseTier;
    } else {
      where.license_tier = { not: 'blocked' };
    }

    // TODO: tenant-aware visibility using ctx.tenantId when you add entitlements.

    const [items, total] = await Promise.all([
      prisma.capabilities.findMany({
        where,
        skip,
        take,
        orderBy: { id: 'asc' },
      }),
      prisma.capabilities.count({ where }),
    ]);

    return { items, total, page, pageSize: take };
  },

  async getCapabilityBySlug(slug: string, ctx: TenantContext) {
    const capability = await prisma.capabilities.findUnique({
      where: { slug },
      include: {
        feature: true,
        repository: true,
      },
    });

    if (!capability) return null;

    // Visibility and license policy
    if (capability.visibility === 'private') return null;
    if (capability.license_tier === 'blocked' || capability.license_tier === 'unclassified') {
      return null;
    }

    // TODO: tenant entitlements using ctx.tenantId.

    return capability;
  },
};