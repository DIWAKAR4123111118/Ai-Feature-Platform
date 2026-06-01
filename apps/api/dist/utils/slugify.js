"use strict";
// apps/api/src/utils/slugify.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.slugifyDockerName = slugifyDockerName;
/**
 * Create a Docker-safe slug from an arbitrary feature name.
 * - Lowercase
 * - Only [a-z0-9._-]
 * - Spaces and other characters become single hyphens
 */
function slugifyDockerName(name) {
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
