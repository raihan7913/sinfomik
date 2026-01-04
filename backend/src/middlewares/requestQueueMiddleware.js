// backend/src/middlewares/requestQueueMiddleware.js
// Middleware to limit concurrent requests and prevent resource exhaustion

const activeRequests = new Map(); // Track active requests per endpoint
const requestQueue = new Map(); // Queue for each endpoint

// Configuration per endpoint type
const LIMITS = {
    expensive: { // For analytics, exports, file uploads
        maxConcurrent: parseInt(process.env.MAX_CONCURRENT_EXPENSIVE) || 15, // Increased from 5 to 15
        maxQueue: 50, // Increased from 20 to 50
        timeout: 120000 // 120 seconds - allow time for file uploads
    },
    moderate: { // For admin, guru routes
        maxConcurrent: parseInt(process.env.MAX_CONCURRENT_MODERATE) || 100, // Increased from 50 to 100
        maxQueue: 200, // Increased from 100 to 200
        timeout: 30000 // 30 seconds
    },
    light: { // For simple operations
        maxConcurrent: parseInt(process.env.MAX_CONCURRENT_LIGHT) || 300, // Increased from 200 to 300
        maxQueue: 1000, // Increased from 500 to 1000
        timeout: 15000 // 15 seconds
    }
};

/**
 * Create a request queue middleware for a specific endpoint type
 * @param {string} type - 'expensive', 'moderate', or 'light'
 */
function createQueueMiddleware(type = 'moderate') {
    const config = LIMITS[type] || LIMITS.moderate;
    const endpointKey = type;

    return async (req, res, next) => {
        // Initialize tracking for this endpoint if not exists
        if (!activeRequests.has(endpointKey)) {
            activeRequests.set(endpointKey, 0);
            requestQueue.set(endpointKey, []);
        }

        const currentActive = activeRequests.get(endpointKey);
        const queue = requestQueue.get(endpointKey);

        // Check if we can process immediately
        if (currentActive < config.maxConcurrent) {
            processRequest();
            return;
        }

        // Check if queue is full
        if (queue.length >= config.maxQueue) {
            console.warn(`🚨 Queue full for ${type} operations. IP: ${req.ip}, Path: ${req.path}`);
            return res.status(503).json({
                error: 'Service temporarily unavailable',
                message: 'Server sedang sibuk. Silakan coba lagi dalam beberapa saat.',
                retryAfter: 30
            });
        }

        // Add to queue
        console.log(`⏳ Queueing request for ${type} operation. Queue size: ${queue.length + 1}`);
        
        const timeout = setTimeout(() => {
            // Remove from queue if timeout
            const index = queue.indexOf(resolve);
            if (index > -1) {
                queue.splice(index, 1);
                res.status(504).json({
                    error: 'Request timeout',
                    message: 'Permintaan memakan waktu terlalu lama. Silakan coba lagi.'
                });
            }
        }, config.timeout);

        let resolve;
        const promise = new Promise(r => resolve = r);
        queue.push(resolve);

        // Wait for our turn
        await promise;
        clearTimeout(timeout);
        processRequest();

        function processRequest() {
            // Increment active requests
            activeRequests.set(endpointKey, activeRequests.get(endpointKey) + 1);

            // Track when request completes
            const originalEnd = res.end;
            const originalJson = res.json;

            const cleanup = () => {
                // Decrement active requests
                const newActive = activeRequests.get(endpointKey) - 1;
                activeRequests.set(endpointKey, Math.max(0, newActive));

                // Process next in queue
                const nextInQueue = queue.shift();
                if (nextInQueue) {
                    nextInQueue();
                }
            };

            res.end = function(...args) {
                cleanup();
                originalEnd.apply(res, args);
            };

            res.json = function(...args) {
                cleanup();
                originalJson.apply(res, args);
            };

            // Handle connection close
            res.on('close', () => {
                if (!res.writableEnded) {
                    cleanup();
                }
            });

            next();
        }
    };
}

// Export middleware functions
const expensiveQueueMiddleware = createQueueMiddleware('expensive');
const moderateQueueMiddleware = createQueueMiddleware('moderate');
const lightQueueMiddleware = createQueueMiddleware('light');

// Export stats function for monitoring
function getQueueStats() {
    const stats = {};
    for (const [key, active] of activeRequests.entries()) {
        stats[key] = {
            active,
            queued: requestQueue.get(key)?.length || 0,
            limit: LIMITS[key]?.maxConcurrent || 0
        };
    }
    return stats;
}

module.exports = {
    expensiveQueueMiddleware,
    moderateQueueMiddleware,
    lightQueueMiddleware,
    getQueueStats
};
