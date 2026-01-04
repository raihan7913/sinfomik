// backend/src/server.js
// Load environment variables FIRST, before requiring anything else
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../../.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { getDb } = require('./config/db'); // Import PostgreSQL adapter
const initializeDatabasePostgres = require('./init_db_postgres_simple'); // Import database initialization (simplified, idempotent)
const { expensiveQueueMiddleware, moderateQueueMiddleware, lightQueueMiddleware, getQueueStats } = require('./middlewares/requestQueueMiddleware');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const guruRoutes = require('./routes/guruRoutes');
const excelRoutes = require('./routes/excelRoutes');
const gradeRoutes = require('./routes/gradeRoutes');
const kkmRoutes = require('./routes/kkmRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');

const app = express();
const PORT = process.env.PORT || 5000; // Gunakan port dari .env atau default 5000
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// ===============================
// TRUST PROXY (for Azure App Service)
// ===============================
// Azure App Service uses a reverse proxy, so we need to trust the proxy
app.set('trust proxy', 1);

// ===============================
// SECURITY MIDDLEWARE
// ===============================

// 1. Helmet - Set security HTTP headers
app.use(helmet({
    contentSecurityPolicy: false, // Disable untuk development, enable di production
    crossOriginEmbedderPolicy: false
}));

// 2. CORS - Configure properly untuk specific origin
// In production, if frontend is served from same domain, allow same origin
// In development, allow localhost:3000 and local network IPs
const corsOptions = {
    origin: process.env.NODE_ENV === 'production' 
        ? [FRONTEND_URL, 'https://*.azurewebsites.net', 'https://*.azurestaticapps.net', 'https://sinfomik-backend-gzcng8eucydhgucz.southeastasia-01.azurewebsites.net', 'https://salmon-glacier-082ece600.3.azurestaticapps.net'] // Allow Azure domains
        : function (origin, callback) {
            // Allow requests with no origin (like mobile apps or curl)
            if (!origin) return callback(null, true);
            
            // Allow localhost and local network IPs (192.168.x.x, 10.x.x.x)
            if (origin.match(/^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/)) {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        },
    credentials: true,
    exposedHeaders: ['Content-Disposition']
};

app.use(cors(corsOptions));

// 3. Rate Limiting - Prevent brute force attacks
// IMPROVED: Much stricter limits to prevent DDoS
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || (process.env.NODE_ENV === 'production' ? 1000 : 2000), // 1000 for prod, 2000 for dev
    message: {
        error: 'Too many requests',
        message: 'Anda telah mencapai batas request. Silakan tunggu beberapa saat sebelum mencoba lagi.',
        retryAfter: '15 menit'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        console.log(`⚠️  Rate limit exceeded for IP: ${req.ip} on ${req.path}`);
        res.status(429).json({
            error: 'Too many requests',
            message: 'Anda telah mencapai batas request. Silakan tunggu beberapa saat sebelum mencoba lagi.',
            retryAfter: '15 menit'
        });
    }
});

// Apply rate limiting only to API routes (avoid counting static asset reloads)
app.use('/api', limiter);

// Stricter rate limit for auth routes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || (process.env.NODE_ENV === 'production' ? 100 : 200), // 100 for prod, 200 for dev
    message: 'Terlalu banyak percobaan login. Silakan coba lagi setelah 15 menit.',
    skipSuccessfulRequests: true, // Don't count successful requests
    handler: (req, res) => {
        console.warn(`🚨 Auth rate limit exceeded for IP: ${req.ip}`);
        res.status(429).json({
            error: 'Too many login attempts',
            message: 'Terlalu banyak percobaan login. Silakan coba lagi setelah 15 menit.'
        });
    }
});

// ADDED: Very strict limit for expensive operations (analytics, exports)
// Note: File uploads have separate concurrency control via multer + queue
const expensiveOpLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: process.env.NODE_ENV === 'production' ? 30 : 100, // 30 requests per 5 min in production, 100 in dev
    message: 'Operasi ini memerlukan banyak sumber daya. Silakan tunggu beberapa saat.',
    handler: (req, res) => {
        console.warn(`🚨 Expensive operation limit exceeded for IP: ${req.ip} on ${req.path}`);
        res.status(429).json({
            error: 'Rate limit exceeded',
            message: 'Operasi ini memerlukan banyak sumber daya. Silakan tunggu beberapa saat.',
            retryAfter: 300 // 5 minutes in seconds
        });
    }
});

// ADDED: Moderate limit for general read operations
const readLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: process.env.NODE_ENV === 'production' ? 200 : 500, // 200 per minute in production, 500 in dev
    message: 'Terlalu banyak permintaan. Silakan tunggu sebentar.',
});

// 4. Body parser with size limits
// NOTE: File uploads are handled separately by multer (configured per route with 5MB limit)
// This limit affects JSON/form-encoded request bodies. Set to 10MB for large Excel data processing
app.use(express.json({ limit: process.env.MAX_JSON_SIZE || '10mb' })); // Allow large JSON for Excel data
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // Allow large form data

// Special handling for file uploads (will be handled by multer in routes)

// ===============================
// ROUTES
// ===============================

// Auth routes with stricter rate limiting
app.use('/api/auth', authLimiter, lightQueueMiddleware, authRoutes);

// IMPROVED: Apply appropriate rate limiters + queue middleware per route group
// Expensive operations (analytics, exports) - very strict
app.use('/api/analytics', expensiveOpLimiter, expensiveQueueMiddleware, analyticsRoutes);
app.use('/api/excel', expensiveOpLimiter, expensiveQueueMiddleware, excelRoutes);

// Protected routes with moderate rate limiting + queue
app.use('/api/admin', readLimiter, moderateQueueMiddleware, adminRoutes);
app.use('/api/guru', readLimiter, moderateQueueMiddleware, guruRoutes);
app.use('/api/grades', readLimiter, moderateQueueMiddleware, gradeRoutes);
app.use('/api/kkm', readLimiter, moderateQueueMiddleware, kkmRoutes);

// Health check endpoint (before static files)
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ADDED: Detailed health check with DB and metrics
app.get('/api/health/detailed', async (req, res) => {
    const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        database: 'unknown',
        queue: getQueueStats()
    };

    // Check database connection
    try {
        const db = getDb();
        await new Promise((resolve, reject) => {
            db.get('SELECT 1', [], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        health.database = 'connected';
    } catch (err) {
        health.status = 'degraded';
        health.database = 'disconnected';
        health.error = err.message;
    }

    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
});

// ADDED: Metrics endpoint for monitoring
app.get('/api/metrics', (req, res) => {
    // Only allow from localhost or with auth token
    const allowedIPs = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
    if (!allowedIPs.includes(req.ip) && req.headers['authorization'] !== `Bearer ${process.env.METRICS_TOKEN}`) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    const metrics = {
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        queue: getQueueStats(),
        nodeVersion: process.version,
        platform: process.platform,
        env: process.env.NODE_ENV || 'development'
    };

    res.json(metrics);
});

// API routes check
app.get('/api', (req, res) => {
    res.json({ 
        message: 'API Sistem Manajemen Akademik Berjalan!',
        version: '1.0.0',
        security: 'hardened',
        status: 'healthy'
    });
});

// ===============================
// SERVE FRONTEND IN PRODUCTION
// ===============================
if (process.env.NODE_ENV === 'production') {
    // Serve static files from React build
    const frontendBuildPath = path.join(__dirname, '../../frontend/build');
    app.use(express.static(frontendBuildPath));
    
    // Handle React routing - return index.html for all non-API routes
    app.get('*', (req, res) => {
        // Skip if it's an API route
        if (req.path.startsWith('/api/')) {
            return res.status(404).json({ message: 'API endpoint not found' });
        }
        res.sendFile(path.join(frontendBuildPath, 'index.html'));
    });
} else {
    // Development mode - just return API info
    app.get('/', (req, res) => {
        res.json({ 
            message: 'API Sistem Manajemen Akademik Berjalan!',
            version: '1.0.0',
            security: 'hardened',
            status: 'healthy',
            mode: 'development'
        });
    });
    
    // 404 handler for development
    app.use((req, res) => {
        res.status(404).json({ message: 'Endpoint not found' });
    });
}

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(err.status || 500).json({ 
        message: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// Start server with graceful EADDRINUSE fallback
function startServer(port, attempt = 0) {
    const srv = app.listen(port, () => {
        console.log(`\n🚀 Server berjalan di http://localhost:${port}`);
        console.log(`🔒 Security: ENABLED (Helmet, Rate Limit, CORS)`);
        console.log(`🌐 Frontend URL: ${FRONTEND_URL}`);
        console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}\n`);
    });
    
    // ===============================
    // DDOS PROTECTION: HTTP TIMEOUTS
    // ===============================
    // Prevent Slowloris attacks
    srv.timeout = 30000; // 30 seconds - force close slow requests
    srv.keepAliveTimeout = 65000; // 65 seconds - slightly longer than typical load balancer timeout (60s)
    srv.headersTimeout = 66000; // Must be > keepAliveTimeout
    
    // Limit concurrent connections per IP (basic protection)
    srv.maxConnections = process.env.MAX_CONNECTIONS || 500; // Max 500 concurrent connections total
    
    // Track connections for monitoring
    let activeConnections = 0;
    srv.on('connection', (socket) => {
        activeConnections++;
        socket.on('close', () => {
            activeConnections--;
        });
        
        // Force close idle connections after timeout
        socket.setTimeout(45000); // 45 seconds for socket idle
        socket.on('timeout', () => {
            console.warn(`⚠️  Socket timeout - closing connection from ${socket.remoteAddress}`);
            socket.destroy();
        });
    });
    
    // Log active connections every minute (for monitoring)
    setInterval(() => {
        if (activeConnections > 100) {
            console.log(`📊 Active connections: ${activeConnections}`);
        }
    }, 60000);
    srv.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            const nextPort = port + 1;
            if (attempt < 5) {
                console.warn(`⚠️  Port ${port} in use. Mencoba port alternatif: ${nextPort}`);
                startServer(nextPort, attempt + 1);
            } else {
                console.error('❌ Gagal menemukan port kosong setelah beberapa percobaan.');
                process.exit(1);
            }
        } else {
            console.error('❌ Server error:', err);
            process.exit(1);
        }
    });
    
    // ===============================
    // GRACEFUL SHUTDOWN
    // ===============================
    const gracefulShutdown = async (signal) => {
        console.log(`\n⚠️  ${signal} received. Starting graceful shutdown...`);
        
        // Stop accepting new connections
        srv.close(async () => {
            console.log('✅ HTTP server closed');
            
            // Close database connections
            try {
                const { closePool } = require('./config/db');
                await closePool();
                console.log('✅ Database pool closed');
            } catch (err) {
                console.error('❌ Error closing database:', err);
            }
            
            console.log('✅ Graceful shutdown complete');
            process.exit(0);
        });
        
        // Force exit if graceful shutdown takes too long
        setTimeout(() => {
            console.error('⚠️  Graceful shutdown timeout - forcing exit');
            process.exit(1);
        }, 10000); // 10 seconds timeout
    };
    
    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
    return srv;
}

// Initialize database then start server
(async () => {
    try {
        await initializeDatabasePostgres();
        startServer(Number(PORT));
    } catch (error) {
        console.error('❌ Failed to initialize database:', error);
        process.exit(1);
    }
})();
