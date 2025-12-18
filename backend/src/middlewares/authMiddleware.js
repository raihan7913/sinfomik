// backend/src/middlewares/authMiddleware.js
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'sinfomik_super_secret_key_2025_change_in_production_please';

// Middleware to verify JWT token with single-session enforcement
exports.verifyToken = (req, res, next) => {
    const { getDb } = require('../config/db');
    
    // Get token from header
    const token = req.headers['authorization']?.split(' ')[1]; // Expected format: "Bearer <token>"
    
    if (!token) {
        return res.status(401).json({ 
            message: 'Access denied. No token provided.',
            requiresAuth: true 
        });
    }

    try {
        // Verify token
        const decoded = jwt.verify(token, JWT_SECRET);
        console.log(`[SESSION] Token decoded - User: ${decoded.id}, Type: ${decoded.user_type}, AuthSource: ${decoded.auth_source || 'N/A'}, AuthID: ${decoded.auth_id || 'N/A'}, Token IAT: ${decoded.iat}`);
        
        // Validate single session: check if this token is still the latest session
        const db = getDb();
        // Determine which DB table to check for last_login_timestamp. Tokens coming from a Guru promoted to Admin include auth_source='Guru'
        const tableName = decoded.auth_source || (decoded.user_type === 'admin' ? 'Admin' : 'Guru');
        const idField = tableName === 'Admin' ? 'id_admin' : 'id_guru';
        const idToLookup = decoded.auth_id || decoded.id;
        
        db.get(
            `SELECT last_login_timestamp FROM ${tableName} WHERE ${idField} = ?`,
            [idToLookup],
            (err, row) => {
                if (err) {
                    console.error('Session validation error:', err);
                    return res.status(500).json({ message: 'Session validation failed.' });
                }
                
                console.log(`[SESSION] DB last_login_timestamp: ${row ? row.last_login_timestamp : 'N/A'}`);
                
                // If no last_login_timestamp, allow (backward compatibility)
                if (!row || !row.last_login_timestamp) {
                    console.log(`[SESSION] ✓ No timestamp found - allowing (backward compatibility)`);
                    req.user = {
                        id: decoded.id,
                        user_type: decoded.user_type,
                        nama: decoded.nama,
                        role: decoded.role || null,
                        auth_source: decoded.auth_source || (decoded.user_type === 'admin' ? 'Admin' : 'Guru'),
                        auth_id: decoded.auth_id || decoded.id
                    };
                    return next();
                }
                
                // Compare token issued-at time with last_login_timestamp
                // If token was issued BEFORE last login, it's an old session
                console.log(`[SESSION] Comparing - Token IAT: ${decoded.iat}, DB Timestamp: ${row.last_login_timestamp}, Diff: ${decoded.iat - row.last_login_timestamp}s`);
                
                if (decoded.iat < row.last_login_timestamp) {
                    console.log(`[SESSION] ❌ OLD SESSION - Token was issued before last login. Rejecting!`);
                    return res.status(401).json({ 
                        message: 'This session has been logged out. You logged in from another device. Please login again.',
                        requiresAuth: true,
                        sessionInvalidated: true
                    });
                }
                
                console.log(`[SESSION] ✓ Valid session - Token is latest`);
                // Token is valid and latest session
                req.user = {
                    id: decoded.id,
                    user_type: decoded.user_type,
                    nama: decoded.nama,
                    role: decoded.role || null,
                    auth_source: decoded.auth_source || (decoded.user_type === 'admin' ? 'Admin' : 'Guru'),
                    auth_id: decoded.auth_id || decoded.id
                };
                next();
            }
        );
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                message: 'Token has expired. Please login again.',
                requiresAuth: true,
                tokenExpired: true
            });
        }
        
        return res.status(403).json({ 
            message: 'Invalid token.',
            requiresAuth: true
        });
    }
};

// Middleware to check if user is admin
exports.isAdmin = (req, res, next) => {
    if (req.user && req.user.user_type === 'admin') {
        next();
    } else {
        return res.status(403).json({ 
            message: 'Access denied. Admin privileges required.' 
        });
    }
};

// Middleware to check if user is guru
exports.isGuru = (req, res, next) => {
    if (req.user && req.user.user_type === 'guru') {
        next();
    } else {
        return res.status(403).json({ 
            message: 'Access denied. Guru privileges required.' 
        });
    }
};

// Middleware to check if user is admin or guru
exports.isAdminOrGuru = (req, res, next) => {
    if (req.user && (req.user.user_type === 'admin' || req.user.user_type === 'guru')) {
        next();
    } else {
        return res.status(403).json({ 
            message: 'Access denied. Admin or Guru privileges required.' 
        });
    }
};

// Middleware to check if user is superadmin
exports.isSuperAdmin = (req, res, next) => {
    if (req.user && req.user.user_type === 'admin' && req.user.role === 'superadmin') {
        next();
    } else {
        return res.status(403).json({ message: 'Access denied. Superadmin privileges required.' });
    }
};
