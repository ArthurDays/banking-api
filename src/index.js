const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./database');
const { swaggerUi, specs } = require('./swagger');
const { secureErrorHandler } = require('./middleware/security');

const app = express();
const PORT = process.env.PORT || 3000;

// Rate Limiting - Simple in-memory implementation
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minuto
const RATE_LIMIT_MAX = 100; // 100 requests por minuto

function rateLimiter(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();

    if (!rateLimitStore.has(ip)) {
        rateLimitStore.set(ip, { count: 1, startTime: now });
        return next();
    }

    const record = rateLimitStore.get(ip);

    if (now - record.startTime > RATE_LIMIT_WINDOW) {
        rateLimitStore.set(ip, { count: 1, startTime: now });
        return next();
    }

    if (record.count >= RATE_LIMIT_MAX) {
        return res.status(429).json({
            success: false,
            error: 'Muitas requisicoes. Tente novamente em alguns minutos.'
        });
    }

    record.count++;
    next();
}

// Limpar rate limit store periodicamente
setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of rateLimitStore.entries()) {
        if (now - record.startTime > RATE_LIMIT_WINDOW * 2) {
            rateLimitStore.delete(ip);
        }
    }
}, RATE_LIMIT_WINDOW);

// CORS Configuration
const corsOptions = {
    origin: process.env.NODE_ENV === 'production'
        ? process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000']
        : '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

// Security Headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com", "cdnjs.cloudflare.com"],
            fontSrc: ["'self'", "fonts.gstatic.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net", "cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'", "ws:", "wss:"],
        },
    },
    crossOriginEmbedderPolicy: false,
}));

// Middlewares
app.use(cors(corsOptions));
app.use(express.json({ limit: '10kb' }));
app.use(rateLimiter);

// Servir arquivos estaticos do frontend
app.use(express.static(path.join(__dirname, '..', 'public')));

// Logging middleware
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.path}`);
    next();
});

// Rota de saude
app.get('/api/health', (req, res) => {
    res.json({
        status: 'online',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Inicializar banco de dados e depois iniciar servidor
async function start() {
    try {
        await initDatabase();
        console.log('[OK] Banco de dados inicializado');

        // Carregar rotas apos inicializacao do banco
        const accountsRoutes = require('./routes/accounts');
        const transactionsRoutes = require('./routes/transactions');
        const { router: authRoutes } = require('./routes/auth');

        app.use('/api/auth', authRoutes);
        app.use('/api/accounts', accountsRoutes);
        app.use('/api/transactions', transactionsRoutes);

        // Swagger Documentation
        app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(specs, {
            customCss: '.swagger-ui .topbar { display: none }',
            customSiteTitle: 'NeoBank API Docs'
        }));

        // Rota para servir o frontend em qualquer rota nao-API
        app.get('*', (req, res) => {
            if (!req.path.startsWith('/api')) {
                res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
            } else {
                res.status(404).json({ success: false, error: 'Endpoint nao encontrado' });
            }
        });

        // Error handler global (production safe)
        app.use(secureErrorHandler);

        const server = app.listen(PORT, () => {
            console.log(`
============================================================
                     BANKING API                            
============================================================
  Servidor rodando na porta ${PORT}                       
  Frontend: http://localhost:${PORT}                      
  API: http://localhost:${PORT}/api                       
  Docs: http://localhost:${PORT}/api/docs                  
  WebSocket: ws://localhost:${PORT}                       
============================================================
      `);
        });

        // WebSocket Server
        const WebSocket = require('ws');
        const wss = new WebSocket.Server({ server });

        wss.on('connection', (ws) => {
            console.log('[WS] Novo cliente WebSocket conectado');

            ws.on('close', () => {
                console.log('[WS] Cliente WebSocket desconectado');
            });
        });

        // Broadcast function for real-time updates
        global.broadcast = (type, data) => {
            wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ type, data, timestamp: new Date().toISOString() }));
                }
            });
        };

    } catch (error) {
        console.error('[ERROR] Erro ao iniciar:', error);
        process.exit(1);
    }
}

start();

module.exports = app;
