"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const logger_1 = require("./logger");
const features_1 = __importDefault(require("./routes/features"));
const scans_1 = __importDefault(require("./routes/scans"));
const auth_1 = __importDefault(require("./routes/auth"));
const repositories_1 = __importDefault(require("./routes/repositories"));
const internal_1 = __importDefault(require("./routes/internal"));
const adapters_1 = __importDefault(require("./routes/adapters"));
const analysis_1 = __importDefault(require("./routes/analysis"));
const auth_2 = require("./middleware/auth");
const app = (0, express_1.default)();
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Request logging
app.use((req, res, next) => {
    logger_1.logger.info({ method: req.method, url: req.url }, 'Incoming request');
    next();
});
// Health
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// Public auth routes (register/login)
app.use('/auth', auth_1.default);
// All routes below this line require JWT
app.use(auth_2.authMiddleware);
app.use('/repositories', repositories_1.default);
app.use('/adapters', adapters_1.default);
app.use('/analysis', analysis_1.default);
app.use('/api', scans_1.default);
app.use('/features', features_1.default);
app.use('/internal', internal_1.default);
// Error handler
app.use((err, req, res, _next) => {
    logger_1.logger.error({ err, url: req.url }, 'Request error');
    res.status(500).json({ error: 'Internal server error' });
});
exports.default = app;
