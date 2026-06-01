"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
const pg_1 = require("pg");
const logger_1 = require("../logger");
// Force dotenv to load from the correct path
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../../.env') });
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error('DATABASE_URL is not defined in environment variables');
}
logger_1.logger.info({ connectionString: connectionString.replace(/:[^:@]+@/, ':****@') }, 'Connecting to database');
exports.pool = new pg_1.Pool({
    connectionString,
});
exports.pool.on('connect', () => {
    logger_1.logger.info('Database connected successfully');
});
exports.pool.on('error', (err) => {
    logger_1.logger.error({ err }, 'Database connection error');
});
