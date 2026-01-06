// backend/src/controllers/authController.js
const { getDb } = require('../config/db');
const { createHash } = require('crypto'); // Untuk hashing SHA256 (sesuai data dummy Python)
const bcrypt = require('bcryptjs'); // Untuk membandingkan hash password (jika menggunakan bcrypt)
const jwt = require('jsonwebtoken'); // Untuk JWT authentication
const JWT_SECRET = process.env.JWT_SECRET || 'sinfomik_super_secret_key_2025_change_in_production_please';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '5h'; // Testing: 5h, Production: 24h
// ✅ Cookie sameSite policy: 'none' for Azure cross-origin, 'lax' for VM same-origin
const COOKIE_SAME_SITE = process.env.COOKIE_SAME_SITE || 'none';

// Helper untuk hashing password (sesuai dengan yang digunakan di Python hashlib.sha256)
function hashPasswordPythonStyle(password) {
    return createHash('sha256').update(password).digest('hex');
}

// Helper untuk hashing dengan bcrypt (more secure)
async function hashPasswordBcrypt(password) {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
}

exports.login = (req, res) => {
    const { username, password, user_type } = req.body;
    const db = getDb();

    if (user_type === 'siswa') {
        return res.status(400).json({ message: 'Role siswa tidak memiliki akses login.' });
    }

    const handleSuccessfulLogin = async (authSource, authId, displayName, roleForToken, password_hash_field_present) => {
        // Generate token with role and auth information
        const payload = {
            id: authId,
            user_type: 'admin',
            nama: displayName,
            role: roleForToken || 'admin',
            auth_source: authSource,
            auth_id: authId
        };

        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
        const decoded = jwt.decode(token);
        const issuedAt = decoded.iat;

        // Update last_login_timestamp on the proper table
        const updateQuery = authSource === 'Admin'
            ? `UPDATE Admin SET last_login_timestamp = $1 WHERE id_admin = $2`
            : `UPDATE Guru SET last_login_timestamp = $1 WHERE id_guru = $2`;

        // ✅ Convert to Promise to ensure DB update completes BEFORE sending response
        await new Promise((resolve, reject) => {
            db.run(updateQuery, [issuedAt, authId], function(err) {
                if (err) {
                    console.error('Failed to update last_login_timestamp:', err);
                    reject(err);
                } else {
                    console.log(`✅ Session initialized for admin (source=${authSource}): ${displayName} at timestamp ${issuedAt}`);
                    resolve();
                }
            });
        });
        
        // ✅ Clear old cookie first to prevent conflicts
        res.clearCookie('authToken', {
            httpOnly: true,
            secure: true,
            sameSite: COOKIE_SAME_SITE,
            path: '/'
        });
        
        // Set JWT token sebagai HTTP-only cookie (XSS protection)
        // ✅ Flexible deployment: Azure (cross-origin) vs VM (same-origin)
        res.cookie('authToken', token, {
            httpOnly: true,      // Tidak bisa diakses via JavaScript (XSS protection)
            secure: true,        // ✅ ALWAYS true for HTTPS (Azure & VM production)
            sameSite: COOKIE_SAME_SITE,  // ✅ 'none' (Azure cross-origin) or 'lax' (VM same-origin)
            maxAge: 5 * 60 * 60 * 1000,  // 5 hours (sesuai JWT_EXPIRES_IN)
            path: '/'            // ✅ Explicit path for better compatibility
        });
        
        res.status(200).json({
            success: true,
            message: 'Login berhasil!',
            user: {
                id: authId,
                username: displayName,
                type: 'admin',
                role: roleForToken || 'admin',
                auth_source: authSource,
                auth_id: authId
            }
            // Token tidak dikirim di response body untuk keamanan
        });
    };

    // Admin login flow: support Admin table (superadmin or admin entries) or Guru with is_admin flag
    if (user_type === 'admin') {
        // 1) Check Admin table first
        db.get("SELECT id_admin, nama, password_hash, role FROM Admin WHERE username = $1", [username], async (err, adminRow) => {
            if (err) {
                console.error('Database error during admin lookup:', err.message);
                return res.status(500).json({ message: 'Terjadi kesalahan server.' });
            }

            if (adminRow) {
                // Verify password
                let isPasswordValid = false;
                if (adminRow.password_hash.startsWith('$2a$') || adminRow.password_hash.startsWith('$2b$')) {
                    isPasswordValid = await bcrypt.compare(password, adminRow.password_hash);
                } else {
                    isPasswordValid = hashPasswordPythonStyle(password) === adminRow.password_hash;
                    if (isPasswordValid) {
                        const newHash = await hashPasswordBcrypt(password);
                        db.run("UPDATE Admin SET password_hash = $1 WHERE id_admin = $2", [newHash, adminRow.id_admin], (err) => {
                            if (err) console.error('Failed to upgrade admin password hash:', err);
                            else console.log(`✅ Upgraded admin password to bcrypt for ${adminRow.nama}`);
                        });
                    }
                }

                if (!isPasswordValid) {
                    return res.status(401).json({ message: 'Username atau password salah.' });
                }

                // Use role from Admin table (default to 'superadmin' for initial admin if unset)
                const roleName = adminRow.role || 'superadmin';
                return handleSuccessfulLogin('Admin', adminRow.id_admin, adminRow.nama, roleName);
            }

            // 2) If not found in Admin, fallback to Guru table and check is_admin flag
            db.get("SELECT id_guru, nama_guru, password_hash, is_admin FROM Guru WHERE username = $1", [username], async (err2, guruRow) => {
                if (err2) {
                    console.error('Database error during guru lookup:', err2.message);
                    return res.status(500).json({ message: 'Terjadi kesalahan server.' });
                }

                if (!guruRow || !guruRow.is_admin) {
                    return res.status(401).json({ message: 'User not found or not an admin.' });
                }

                let isPasswordValid = false;
                if (guruRow.password_hash.startsWith('$2a$') || guruRow.password_hash.startsWith('$2b$')) {
                    isPasswordValid = await bcrypt.compare(password, guruRow.password_hash);
                } else {
                    isPasswordValid = hashPasswordPythonStyle(password) === guruRow.password_hash;
                    if (isPasswordValid) {
                        const newHash = await hashPasswordBcrypt(password);
                        db.run("UPDATE Guru SET password_hash = $1 WHERE id_guru = $2", [newHash, guruRow.id_guru], (err) => {
                            if (err) console.error('Failed to upgrade guru password hash:', err);
                            else console.log(`✅ Upgraded guru password to bcrypt for ${guruRow.nama_guru}`);
                        });
                    }
                }

                if (!isPasswordValid) {
                    return res.status(401).json({ message: 'Username atau password salah.' });
                }

                // Treat this Guru as admin (role='admin')
                return handleSuccessfulLogin('Guru', guruRow.id_guru, guruRow.nama_guru, 'admin');
            });
        });

        return; // Exit, response will be sent from callbacks above
    }

    // Guru login flow (regular guru user)
    if (user_type === 'guru') {
        db.get("SELECT id_guru, nama_guru, password_hash, is_admin FROM Guru WHERE username = $1", [username], async (err, user) => {
            if (err) {
                console.error('Database error during login:', err.message);
                return res.status(500).json({ message: 'Terjadi kesalahan server.' });
            }
            if (!user) {
                return res.status(401).json({ message: 'Username atau password salah.' });
            }

            // Bandingkan password - support both SHA256 (legacy) and bcrypt
            let isPasswordValid = false;
            if (user.password_hash.startsWith('$2a$') || user.password_hash.startsWith('$2b$')) {
                isPasswordValid = await bcrypt.compare(password, user.password_hash);
            } else {
                isPasswordValid = hashPasswordPythonStyle(password) === user.password_hash;
                if (isPasswordValid) {
                    const newHash = await hashPasswordBcrypt(password);
                    db.run("UPDATE Guru SET password_hash = $1 WHERE id_guru = $2", [newHash, user.id_guru], (err) => {
                        if (err) {
                            console.error('Failed to upgrade password hash:', err);
                        } else {
                            console.log(`✅ Password upgraded to bcrypt for guru: ${user.nama_guru}`);
                        }
                    });
                }
            }

            if (!isPasswordValid) {
                return res.status(401).json({ message: 'Username atau password salah.' });
            }

            // Generate basic JWT for guru users
            const payload = { id: user.id_guru, user_type: 'guru', nama: user.nama_guru };
            const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
            const decoded = jwt.decode(token);
            const issuedAt = decoded.iat;

            // Update guru last_login_timestamp
            // ✅ Convert to Promise to ensure DB update completes BEFORE sending response
            await new Promise((resolve, reject) => {
                db.run("UPDATE Guru SET last_login_timestamp = $1 WHERE id_guru = $2", [issuedAt, user.id_guru], function(err) {
                    if (err) {
                        console.error('Failed to update last_login_timestamp:', err);
                        reject(err);
                    } else {
                        console.log(`✅ Session initialized for guru: ${user.nama_guru} at timestamp ${issuedAt}`);
                        resolve();
                    }
                });
            });
            
            // ✅ Clear old cookie first to prevent conflicts
            res.clearCookie('authToken', {
                httpOnly: true,
                secure: true,
                sameSite: COOKIE_SAME_SITE,
                path: '/'
            });
            
            // Set JWT token sebagai HTTP-only cookie (XSS protection)
            // ✅ Flexible deployment: Azure (cross-origin) vs VM (same-origin)
            res.cookie('authToken', token, {
                httpOnly: true,      // Tidak bisa diakses via JavaScript (XSS protection)
                secure: true,        // ✅ ALWAYS true for HTTPS (Azure & VM production)
                sameSite: COOKIE_SAME_SITE,  // ✅ 'none' (Azure cross-origin) or 'lax' (VM same-origin)
                maxAge: 5 * 60 * 60 * 1000,  // 5 hours (sesuai JWT_EXPIRES_IN)
                path: '/'            // ✅ Explicit path for better compatibility
            });
            
            res.status(200).json({
                success: true,
                message: 'Login berhasil! (guru)',
                user: {
                    id: user.id_guru,
                    username: user.nama_guru,
                    type: 'guru',
                    is_admin: !!user.is_admin
                }
                // Token tidak dikirim di response body untuk keamanan
            });
        });
    }
};

// Endpoint untuk verify token dan extend session
exports.getCurrentUser = (req, res) => {
    // This endpoint is protected by verifyToken middleware, so token is already verified
    // Return richer user info (role + auth_source if present)
    const user = req.user;
    
    res.status(200).json({
        success: true,
        user: {
            id: user.id,
            username: user.nama,
            type: user.user_type,
            role: user.role || null,
            auth_source: user.auth_source || null,
            auth_id: user.auth_id || null
        },
        message: 'Token masih aktif'
    });
};

// Endpoint untuk logout - clear HTTP-only cookie dan invalidate session
exports.logout = (req, res) => {
    const { getDb } = require('../config/db');
    
    // Get token dari cookie atau header
    let token = req.cookies?.authToken;
    if (!token) {
        token = req.headers['authorization']?.split(' ')[1];
    }
    
    // Jika ada token, invalidate session di database
    if (token) {
        try {
            const jwt = require('jsonwebtoken');
            const JWT_SECRET = process.env.JWT_SECRET || 'sinfomik_super_secret_key_2025_change_in_production_please';
            const decoded = jwt.verify(token, JWT_SECRET);
            
            const db = getDb();
            const tableName = decoded.auth_source || (decoded.user_type === 'admin' ? 'Admin' : 'Guru');
            const idField = tableName === 'Admin' ? 'id_admin' : 'id_guru';
            const idToUpdate = decoded.auth_id || decoded.id;
            
            // Update last_login_timestamp to NOW to invalidate all old tokens
            const updateQuery = `UPDATE ${tableName} SET last_login_timestamp = $1 WHERE ${idField} = $2`;
            const newTimestamp = Math.floor(Date.now() / 1000) + 1; // Future timestamp
            
            db.run(updateQuery, [newTimestamp, idToUpdate], (err) => {
                if (err) {
                    console.error('Failed to invalidate session:', err);
                } else {
                    console.log(`✅ Session invalidated for user ${decoded.nama || decoded.id}`);
                }
            });
        } catch (error) {
            console.error('Error decoding token during logout:', error.message);
        }
    }
    
    // Clear the HTTP-only cookie
    // ✅ Flexible deployment: match sameSite with cookie creation
    res.clearCookie('authToken', {
        httpOnly: true,
        secure: true,
        sameSite: COOKIE_SAME_SITE,  // ✅ Match cookie creation settings
        path: '/'
    });
    
    console.log('✅ User logged out, HTTP-only cookie cleared and session invalidated');
    
    res.status(200).json({
        success: true,
        message: 'Logout berhasil'
    });
};
