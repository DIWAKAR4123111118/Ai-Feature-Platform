// apps/api/src/utils/slugify.ts

/**
 * Create a Docker-safe slug from an arbitrary feature name.
 * - Lowercase
 * - Only [a-z0-9._-]
 * - Spaces and other characters become single hyphens
 */
export function slugifyDockerName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    // Replace any sequence of non-allowed chars with a single hyphen.
    // Allowed in repo name: [a-z0-9._-]
    .replace(/[^a-z0-9._-]+/g, '-')
    // Collapse multiple hyphens
    .replace(/-+/g, '-')
    // Trim leading/trailing hyphens
    .replace(/^-|-$/g, '');
}