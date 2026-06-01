"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RISKY_LICENSES = exports.SAFE_LICENSES = void 0;
exports.classifyLicense = classifyLicense;
exports.getLicenseWarning = getLicenseWarning;
exports.SAFE_LICENSES = [
    'MIT',
    'Apache-2.0',
    'BSD-2-Clause',
    'BSD-3-Clause',
    'ISC',
    '0BSD',
    'Unlicense',
];
exports.RISKY_LICENSES = [
    'GPL-2.0',
    'GPL-3.0',
    'AGPL-3.0',
    'LGPL-2.1',
    'LGPL-3.0',
    'MPL-2.0',
    'EPL-2.0',
    'EUPL-1.2',
];
function classifyLicense(spdxId) {
    if (!spdxId) {
        return {
            tier: 'blocked',
            reason: 'No license detected. Cannot use unlicensed code.',
        };
    }
    if (exports.SAFE_LICENSES.includes(spdxId)) {
        return {
            tier: 'safe',
            reason: 'Permissive license - safe for platform use',
        };
    }
    if (exports.RISKY_LICENSES.includes(spdxId)) {
        return {
            tier: 'risky',
            reason: 'Copyleft license - may impose obligations on your code. Use at your own risk.',
        };
    }
    return {
        tier: 'blocked',
        reason: `Unknown or custom license (${spdxId}). Requires manual review.`,
    };
}
function getLicenseWarning(spdxId) {
    const warnings = {
        'GPL-2.0': 'GPL-2.0 requires derivative works to be open-sourced under GPL. Ensure your use case complies.',
        'GPL-3.0': 'GPL-3.0 has strict copyleft requirements. Using GPL code may require you to open-source your platform.',
        'AGPL-3.0': 'AGPL-3.0 applies copyleft even to network use. Running AGPL code as a service may trigger license obligations.',
        'LGPL-2.1': 'LGPL allows dynamic linking but has specific requirements. Review carefully.',
        'LGPL-3.0': 'LGPL allows dynamic linking but has specific requirements. Review carefully.',
        'MPL-2.0': 'MPL-2.0 requires you to share modifications to MPL-licensed files only.',
        'EPL-2.0': 'EPL-2.0 has weak copyleft requirements. Review compatibility with your use case.',
        'EUPL-1.2': 'EUPL-1.2 has copyleft requirements. Review compatibility carefully.',
    };
    return warnings[spdxId] || 'This license may have restrictions. Review the full license text.';
}
