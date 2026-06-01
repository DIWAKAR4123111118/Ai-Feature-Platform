"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runESLintAdapterOnFile = runESLintAdapterOnFile;
const axios_1 = __importDefault(require("axios"));
const INTERNAL_JWT = process.env.INTERNAL_SERVICE_JWT;
const INTERNAL_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000';
async function runESLintAdapterOnFile(payload) {
    const res = await axios_1.default.post(`${INTERNAL_BASE_URL}/internal/features/eslint/run`, payload, {
        headers: {
            'Content-Type': 'application/json',
            ...(INTERNAL_JWT
                ? { Authorization: `Bearer ${INTERNAL_JWT}` }
                : {}),
        },
    });
    return res.data;
}
