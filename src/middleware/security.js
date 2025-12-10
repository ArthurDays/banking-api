const validator = require('validator');
const uuidValidate = require('uuid-validate');

// ================================
// LOGIN RATE LIMITER (Brute Force Protection)
// ================================
const loginAttempts = new Map();
const LOGIN_LIMIT = 5; // Max attempts
const LOGIN_WINDOW = 60 * 1000; // 1 minute
const LOGIN_BLOCK_TIME = 5 * 60 * 1000; // 5 minutes block

function loginRateLimiter(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress;
    const key = `${ip}:${req.body?.email?.toLowerCase() || 'unknown'}`;
    const now = Date.now();

    const record = loginAttempts.get(key);

    if (record) {
        // Check if still blocked
        if (record.blockedUntil && now < record.blockedUntil) {
            const remainingSeconds = Math.ceil((record.blockedUntil - now) / 1000);
            return res.status(429).json({
                success: false,
                error: `Muitas tentativas de login. Tente novamente em ${remainingSeconds} segundos.`
            });
        }

        // Reset if window expired
        if (now - record.startTime > LOGIN_WINDOW) {
            loginAttempts.set(key, { count: 1, startTime: now });
            return next();
        }

        // Check if exceeded limit
        if (record.count >= LOGIN_LIMIT) {
            loginAttempts.set(key, { ...record, blockedUntil: now + LOGIN_BLOCK_TIME });
            return res.status(429).json({
                success: false,
                error: 'Muitas tentativas de login. Conta temporariamente bloqueada por 5 minutos.'
            });
        }

        record.count++;
    } else {
        loginAttempts.set(key, { count: 1, startTime: now });
    }

    next();
}

// Reset login attempts on successful login
function resetLoginAttempts(ip, email) {
    const key = `${ip}:${email?.toLowerCase() || 'unknown'}`;
    loginAttempts.delete(key);
}

// Cleanup old entries
setInterval(() => {
    const now = Date.now();
    for (const [key, record] of loginAttempts.entries()) {
        if (now - record.startTime > LOGIN_WINDOW * 2 && !record.blockedUntil) {
            loginAttempts.delete(key);
        }
        if (record.blockedUntil && now > record.blockedUntil + LOGIN_WINDOW) {
            loginAttempts.delete(key);
        }
    }
}, 60000);

// ================================
// UUID VALIDATOR
// ================================
function validateUUID(paramName = 'id') {
    return (req, res, next) => {
        const uuid = req.params[paramName];

        if (!uuid) {
            return res.status(400).json({
                success: false,
                error: `Parâmetro ${paramName} é obrigatório`
            });
        }

        if (!uuidValidate(uuid, 4)) {
            return res.status(400).json({
                success: false,
                error: `ID inválido: ${paramName} deve ser um UUID válido`
            });
        }

        next();
    };
}

// ================================
// INPUT SANITIZERS
// ================================
function sanitizeString(str) {
    if (!str || typeof str !== 'string') return str;
    return validator.escape(validator.trim(str));
}

function sanitizeEmail(email) {
    if (!email || typeof email !== 'string') return email;
    return validator.normalizeEmail(validator.trim(email.toLowerCase()));
}

function isValidEmail(email) {
    return validator.isEmail(email || '');
}

function isValidAmount(amount) {
    if (typeof amount !== 'number') return false;
    if (amount <= 0) return false;
    if (!Number.isFinite(amount)) return false;
    // Max 2 decimal places
    if (Math.round(amount * 100) / 100 !== amount) return false;
    return true;
}

// ================================
// ERROR HANDLER (Production Safe)
// ================================
function secureErrorHandler(err, req, res, next) {
    console.error('Error:', {
        message: err.message,
        stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString()
    });

    // Don't expose error details in production
    const message = process.env.NODE_ENV === 'production'
        ? 'Erro interno do servidor'
        : err.message;

    res.status(err.status || 500).json({
        success: false,
        error: message
    });
}

// ================================
// AUDIT LOGGER
// ================================
function auditLog(action, details) {
    const log = {
        timestamp: new Date().toISOString(),
        action,
        ...details
    };
    console.log('[AUDIT]', JSON.stringify(log));
    return log;
}

module.exports = {
    loginRateLimiter,
    resetLoginAttempts,
    validateUUID,
    sanitizeString,
    sanitizeEmail,
    isValidEmail,
    isValidAmount,
    secureErrorHandler,
    auditLog
};
