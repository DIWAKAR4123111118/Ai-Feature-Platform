import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../db';
import { logger } from '../logger';

const router = Router();

// Register
router.post('/register', async (req, res) => {
  try {
    logger.info({ body: req.body }, 'Registration attempt');
    
    const { email, password } = req.body;
    
    if (!email || !password) {
      logger.warn('Missing email or password');
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    logger.info('Hashing password');
    const hashedPassword = await bcrypt.hash(password, 10);
    
    logger.info({ email }, 'Inserting user into database');
    const result = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at',
      [email, hashedPassword]
    );
    
    logger.info({ userId: result.rows[0].id }, 'User created successfully');
    res.status(201).json({ user: result.rows[0] });
  } catch (error: any) {
    logger.error({ 
      error: error.message, 
      code: error.code, 
      stack: error.stack 
    }, 'Registration failed');
    
    if (error.code === '23505') {
      res.status(400).json({ error: 'Email already exists' });
    } else {
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
    logger.info({ email: req.body.email }, 'Login attempt');
    
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    
    if (result.rows.length === 0) {
      logger.warn({ email }, 'User not found');
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!validPassword) {
      logger.warn({ email }, 'Invalid password');
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '7d' }
    );
    
    logger.info({ userId: user.id }, 'User logged in successfully');
    res.json({ token, user: { id: user.id, email: user.email } });
  } catch (error: any) {
    logger.error({ error: error.message }, 'Login failed');
    res.status(500).json({ error: 'Login failed' });
  }
});

export default router;