"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LICENSE_TIERS = void 0;
exports.isLicenseSafeToExpose = isLicenseSafeToExpose;
exports.isLicenseRisky = isLicenseRisky;
exports.isLicenseBlocked = isLicenseBlocked;
exports.LICENSE_TIERS = [
    'safe',
    'risky',
    'blocked',
    'unknown',
];
function isLicenseSafeToExpose(tier) {
    return tier === 'safe';
}
function isLicenseRisky(tier) {
    return tier === 'risky';
}
function isLicenseBlocked(tier) {
    return tier === 'blocked' || tier === 'unknown' || !tier;
}
