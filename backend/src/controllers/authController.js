// backend/src/controllers/authController.js
const { getDb } = require('../config/db');
const { createHash } = require('crypto'); // Untuk hashing SHA256 (sesuai data dummy Python)
const bcrypt = require('bcryptjs'); // Untuk membandingkan hash password (jika menggunakan bcrypt)
const jwt = require('jsonwebtoken'); // Untuk JWT authentication
const JWT_SECRET = process.env.JWT_SECRET || 'sinfomik_super_secret_key_2025_change_in_production_please';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '5h'; // Testing: 5h, Production: 24h

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

        // Update last_login_timestamp on the proper table (do NOT block response on this - fire-and-forget)
        const updateQuery = authSource === 'Admin'
            ? `UPDATE Admin SET last_login_timestamp = $1 WHERE id_admin = $2`
            : `UPDATE Guru SET last_login_timestamp = $1 WHERE id_guru = $2`;

        db.run(updateQuery, [issuedAt, authId], function(err) {
            if (err) {
                console.error('Failed to update last_login_timestamp:', err);
            } else {
                console.log(`✅ Session initialized for admin (source=${authSource}): ${displayName} at timestamp ${issuedAt}`);
            }
            
            // Set HTTP-only cookie with token
            // For Azure cross-domain: use sameSite: 'none' with secure: true
            res.cookie('token', token, {
                httpOnly: true,
                secure: true, // MUST be true for sameSite: 'none' to work
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // 'none' for Azure cross-domain
                maxAge: 5 * 60 * 60 * 1000 // 5 hours in milliseconds
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
                },
                token: token
            });
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
            db.run("UPDATE Guru SET last_login_timestamp = $1 WHERE id_guru = $2", [issuedAt, user.id_guru], function(err) {
                if (err) {
                    console.error('Failed to update last_login_timestamp:', err);
                } else {
                    console.log(`✅ Session initialized for guru: ${user.nama_guru} at timestamp ${issuedAt}`);
                }
                
                // Set HTTP-only cookie with token (same config as admin)
                res.cookie('token', token, {
                    httpOnly: true,
                    secure: true,
                    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
                    maxAge: 5 * 60 * 60 * 1000
                });
                
                res.status(200).json({
                    success: true,
                    message: 'Login berhasil! (guru)',
                    user: {
                        id: user.id_guru,
                        username: user.nama_guru,
                        type: 'guru',
                        is_admin: !!user.is_admin
                    },
                    token: token
                });
            });
        });
    }
};

// Endpoint untuk logout - clear HTTP-only cookie
exports.logout = (req, res) => {
    // Clear the HTTP-only cookie by setting it with expired date
    // MUST match login cookie config for Azure cross-domain
    res.clearCookie('token', {
        httpOnly: true,
        secure: true,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    });
    
    res.status(200).json({
        success: true,
        message: 'Logout berhasil'
    });
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
