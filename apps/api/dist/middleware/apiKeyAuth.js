"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiKeyAuth = apiKeyAuth;
const prismaClient_1 = require("../prismaClient");
async function apiKeyAuth(req, res, next) {
    try {
        const apiKey = req.header('x-api-key');
        if (!apiKey) {
            return res.status(401).json({ error: 'Missing API key' });
        }
        const keyRecord = await prismaClient_1.prisma.project_api_keys.findUnique({
            where: { key: apiKey },
            include: { project: true },
        });
        if (!keyRecord || !keyRecord.active) {
            return res.status(401).json({ error: 'Invalid or inactive API key' });
        }
        const apiReq = req;
        apiReq.projectId = keyRecord.project_id;
        return next();
    }
    catch (err) {
        return res.status(500).json({
            error: 'API key auth failed',
            details: err?.message || String(err),
        });
    }
}
