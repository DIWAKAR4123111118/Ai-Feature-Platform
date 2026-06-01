// apps/api/src/services/licensePolicy.ts
export type LicenseTier = 'safe' | 'risky' | 'blocked' | 'unknown';

export const LICENSE_TIERS: LicenseTier[] = ['safe', 'risky', 'blocked', 'unknown'];

export function isLicenseSafeToExpose(tier: string | null | undefined): boolean {
  return tier === 'safe';
}

export function isLicenseRisky(tier: string | null | undefined): boolean {
  return tier === 'risky';
}

export function isLicenseBlocked(tier: string | null | undefined): boolean {
  return tier === 'blocked' || tier === 'unknown' || !tier;
}