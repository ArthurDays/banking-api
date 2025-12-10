const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { query, queryOne, run } = require('../database');
const { v4: uuidv4 } = require('uuid');
const { loginRateLimiter, resetLoginAttempts, isValidEmail, sanitizeString, auditLog } = require('../middleware/security');

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'neobank-secret-key-2024';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'neobank-refresh-secret-2024';
const ACCESS_TOKEN_EXPIRES = '15m';  // Access token: 15 minutes
const REFRESH_TOKEN_EXPIRES = 7 * 24 * 60 * 60 * 1000; // Refresh token: 7 days

// Middleware to verify JWT
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ success: false, error: 'Token de acesso requerido' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({
                    success: false,
                    error: 'Token expirado',
                    code: 'TOKEN_EXPIRED'
                });
            }
            return res.status(403).json({ success: false, error: 'Token inválido' });
        }
        req.user = user;
        next();
    });
}

// Generate access and refresh tokens
function generateTokens(user) {
    const accessToken = jwt.sign(
        { id: user.id, email: user.email, name: user.name },
        JWT_SECRET,
        { expiresIn: ACCESS_TOKEN_EXPIRES }
    );

    const refreshToken = crypto.randomBytes(64).toString('hex');
    const refreshTokenId = uuidv4();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES).toISOString();

    // Store refresh token in database
    run(
        `INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)`,
        [refreshTokenId, user.id, refreshToken, expiresAt]
    );

    return { accessToken, refreshToken, expiresAt };
}

// Register
router.post('/register', async (req, res) => {
    try {
        const { email, password, name } = req.body;

        // Validations
        if (!email || !password || !name) {
            return res.status(400).json({
                success: false,
                error: 'Campos obrigatórios: email, password, name'
            });
        }

        if (!isValidEmail(email)) {
            return res.status(400).json({
                success: false,
                error: 'Formato de email inválido'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                error: 'A senha deve ter pelo menos 6 caracteres'
            });
        }

        // Check if email already exists
        const existingUser = queryOne('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
        if (existingUser) {
            return res.status(409).json({ success: false, error: 'Email já cadastrado' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // Create user
        const userId = uuidv4();
        const now = new Date().toISOString();

        run(
            `INSERT INTO users (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)`,
            [userId, email.toLowerCase(), passwordHash, name, now]
        );

        const user = { id: userId, email: email.toLowerCase(), name };
        const tokens = generateTokens(user);

        auditLog('REGISTER', { userId, email: user.email });

        res.status(201).json({
            success: true,
            data: {
                user,
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                expiresAt: tokens.expiresAt
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Login (with rate limiting)
router.post('/login', loginRateLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Campos obrigatórios: email, password'
            });
        }

        // Find user
        const user = queryOne('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
        if (!user) {
            return res.status(401).json({ success: false, error: 'Email ou senha incorretos' });
        }

        // Check password
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ success: false, error: 'Email ou senha incorretos' });
        }

        // Reset login attempts on success
        resetLoginAttempts(req.ip, email);

        // Generate tokens
        const tokens = generateTokens(user);

        // Audit log
        auditLog('LOGIN_SUCCESS', { userId: user.id, email: user.email, ip: req.ip });

        res.json({
            success: true,
            data: {
                user: { id: user.id, email: user.email, name: user.name },
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                expiresAt: tokens.expiresAt
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Refresh Token
router.post('/refresh', async (req, res) => {
    try {
        const { refresh_token } = req.body;

        if (!refresh_token) {
            return res.status(400).json({
                success: false,
                error: 'Refresh token é obrigatório'
            });
        }

        // Find token in database
        const tokenRecord = queryOne(
            `SELECT * FROM refresh_tokens WHERE token = ? AND revoked = 0`,
            [refresh_token]
        );

        if (!tokenRecord) {
            return res.status(401).json({
                success: false,
                error: 'Refresh token inválido ou revogado'
            });
        }

        // Check if expired
        if (new Date(tokenRecord.expires_at) < new Date()) {
            // Revoke expired token
            run('UPDATE refresh_tokens SET revoked = 1 WHERE id = ?', [tokenRecord.id]);
            return res.status(401).json({
                success: false,
                error: 'Refresh token expirado'
            });
        }

        // Get user
        const user = queryOne('SELECT id, email, name FROM users WHERE id = ?', [tokenRecord.user_id]);
        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Usuário não encontrado'
            });
        }

        // Revoke old refresh token
        run('UPDATE refresh_tokens SET revoked = 1 WHERE id = ?', [tokenRecord.id]);

        // Generate new tokens
        const tokens = generateTokens(user);

        auditLog('TOKEN_REFRESH', { userId: user.id, email: user.email });

        res.json({
            success: true,
            data: {
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                expiresAt: tokens.expiresAt
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Logout - Revoke refresh token
router.post('/logout', authenticateToken, (req, res) => {
    try {
        const { refresh_token } = req.body;

        if (refresh_token) {
            // Revoke specific refresh token
            run('UPDATE refresh_tokens SET revoked = 1 WHERE token = ?', [refresh_token]);
        } else {
            // Revoke all user's refresh tokens
            run('UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?', [req.user.id]);
        }

        auditLog('LOGOUT', { userId: req.user.id });

        res.json({ success: true, message: 'Logout realizado com sucesso' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get current user
router.get('/me', authenticateToken, (req, res) => {
    const user = queryOne('SELECT id, email, name, role, created_at FROM users WHERE id = ?', [req.user.id]);
    if (!user) {
        return res.status(404).json({ success: false, error: 'Usuário não encontrado' });
    }
    res.json({ success: true, data: user });
});

// Export middleware for use in other routes
module.exports = { router, authenticateToken };
