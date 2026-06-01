"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = require("../db");
const logger_1 = require("../logger");
const router = (0, express_1.Router)();
// Register
router.post('/register', async (req, res) => {
    try {
        logger_1.logger.info({ body: req.body }, 'Registration attempt');
        const { email, password } = req.body;
        if (!email || !password) {
            logger_1.logger.warn('Missing email or password');
            return res.status(400).json({ error: 'Email and password required' });
        }
        logger_1.logger.info('Hashing password');
        const hashedPassword = await bcrypt_1.default.hash(password, 10);
        logger_1.logger.info({ email }, 'Inserting user into database');
        const result = await db_1.pool.query('INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at', [email, hashedPassword]);
        logger_1.logger.info({ userId: result.rows[0].id }, 'User created successfully');
        res.status(201).json({ user: result.rows[0] });
    }
    catch (error) {
        logger_1.logger.error({
            error: error.message,
            code: error.code,
            stack: error.stack
        }, 'Registration failed');
        if (error.code === '23505') {
            res.status(400).json({ error: 'Email already exists' });
        }
        else {
            res.status(500).json({
                error: 'Registration failed',
                details: error.message
            });
        }
    }
});
// Login
router.post('/login', async (req, res) => {
    try {
        logger_1.logger.info({ email: req.body.email }, 'Login attempt');
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }
        const result = await db_1.pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            logger_1.logger.warn({ email }, 'User not found');
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const user = result.rows[0];
        const validPassword = await bcrypt_1.default.compare(password, user.password_hash);
        if (!validPassword) {
            logger_1.logger.warn({ email }, 'Invalid password');
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const token = jsonwebtoken_1.default.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET || 'fallback-secret', { expiresIn: '7d' });
        logger_1.logger.info({ userId: user.id }, 'User logged in successfully');
        res.json({ token, user: { id: user.id, email: user.email } });
    }
    catch (error) {
        logger_1.logger.error({ error: error.message }, 'Login failed');
        res.status(500).json({ error: 'Login failed' });
    }
});
exports.default = router;
