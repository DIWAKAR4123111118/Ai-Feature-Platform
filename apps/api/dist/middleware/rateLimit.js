"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.capabilityRateLimiter = void 0;
// apps/api/src/middleware/rateLimit.ts
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
exports.capabilityRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000, // 1 minute
    max: 60, // 60 requests / minute / API key
    keyGenerator: (req) => {
        const apiReq = req;
        if (apiReq.projectId) {
            return `project:${apiReq.projectId}`;
        }
        // Fallbacks to ensure we ALWAYS return a string
        const ip = (req.ip && req.ip.toString()) ||
            req.headers['x-forwarded-for'] ||
            'unknown';
        return `ip:${ip}`;
    },
});
