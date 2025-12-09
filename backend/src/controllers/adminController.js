// backend/src/controllers/adminController.js
const { getDb } = require('../config/db');
const { createHash } = require('crypto'); // Untuk hashing SHA256 (sesuai data dummy Python)
const { format } = require('date-fns'); // Untuk format tanggal

// Helper untuk hashing password (sesuai dengan yang digunakan di Python)
function hashPasswordPythonStyle(password) {
    return createHash('sha256').update(password).digest('hex');
}

// --- Manajemen Siswa ---
exports.getAllStudents = (req, res) => {
    const db = getDb();

    // Simple query: just get all students
    // Do NOT join with SiswaKelas here - that's for enrollment lookup
    let query = `
        SELECT DISTINCT
            s.id_siswa,
            s.nama_siswa,
            s.tanggal_lahir,
            s.jenis_kelamin,
            s.tahun_ajaran_masuk
        FROM Siswa s
        ORDER BY s.nama_siswa
    `;

    db.all(query, [], (err, rows) => {
        if (err) {
            console.error("Error fetching all students:", err.message);
            return res.status(500).json({ message: err.message });
        }
        res.json(rows);
    });
};

exports.addStudent = (req, res) => {
    const { id_siswa, nama_siswa, tanggal_lahir, jenis_kelamin, tahun_ajaran_masuk } = req.body;
    const db = getDb();
//cuma ngetes aja
    db.run("INSERT INTO Siswa (id_siswa, nama_siswa, tanggal_lahir, jenis_kelamin, tahun_ajaran_masuk) VALUES (?, ?, ?, ?, ?)",
        [id_siswa, nama_siswa, tanggal_lahir || null, jenis_kelamin || null, tahun_ajaran_masuk || null],
        function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(409).json({ message: 'ID Siswa sudah ada.' });
                }
                return res.status(400).json({ message: err.message });
            }
            res.status(201).json({ message: 'Siswa berhasil ditambahkan', id: this.lastID });
        }
    );
};

exports.updateStudent = (req, res) => {
    const { id } = req.params;
    const { nama_siswa, tanggal_lahir, jenis_kelamin, tahun_ajaran_masuk } = req.body;
    const db = getDb();
    const query = "UPDATE Siswa SET nama_siswa = ?, tanggal_lahir = ?, jenis_kelamin = ?, tahun_ajaran_masuk = ? WHERE id_siswa = ?";
    const params = [nama_siswa, tanggal_lahir || null, jenis_kelamin || null, tahun_ajaran_masuk || null, id];

    db.run(query, params, function(err) {
        if (err) return res.status(400).json({ message: err.message });
        if (this.changes === 0) return res.status(404).json({ message: 'Siswa tidak ditemukan atau tidak ada perubahan.' });
        res.json({ message: 'Siswa berhasil diperbarui.' });
    });
};

exports.deleteStudent = (req, res) => {
    const { id } = req.params;
    const db = getDb();

    db.get("SELECT COUNT(*) AS count FROM SiswaKelas WHERE id_siswa = ?", [id], (err, row) => {
        if (err) return res.status(500).json({ message: err.message });
        if (row.count > 0) {
            return res.status(409).json({ message: 'Tidak dapat menghapus siswa. Siswa masih terdaftar di kelas.' });
        }
        db.get("SELECT COUNT(*) AS count FROM Nilai WHERE id_siswa = ?", [id], (err, row) => {
            if (err) return res.status(500).json({ message: err.message });
            if (row.count > 0) {
                return res.status(409).json({ message: 'Tidak dapat menghapus siswa. Siswa masih memiliki data nilai.' });
            }
            db.get("SELECT COUNT(*) AS count FROM SiswaCapaianPembelajaran WHERE id_siswa = ?", [id], (err, row) => {
                if (err) return res.status(500).json({ message: err.message });
                if (row.count > 0) {
                    return res.status(409).json({ message: 'Tidak dapat menghapus siswa. Siswa masih memiliki data capaian pembelajaran.' });
                }

                db.run("DELETE FROM Siswa WHERE id_siswa = ?", [id], function(err) {
                    if (err) return res.status(400).json({ message: err.message });
                    if (this.changes === 0) return res.status(404).json({ message: 'Siswa tidak ditemukan.' });
                    res.json({ message: 'Siswa berhasil dihapus.' });
                });
            });
        });
    });
};

// --- Manajemen Guru ---
exports.getAllTeachers = (req, res) => {
    const db = getDb();
    db.all("SELECT id_guru, username, nama_guru, email FROM Guru", [], (err, rows) => {
        if (err) {
            console.error("Error fetching teachers:", err.message);
            return res.status(500).json({ message: err.message });
        }
        res.json(rows);
    });
};

exports.addTeacher = (req, res) => {
    const { id_guru, username, password, nama_guru, email } = req.body;
    const db = getDb();
    
    // Validate id_guru is provided
    if (!id_guru || !id_guru.trim()) {
        return res.status(400).json({ message: 'ID Guru (NIP) harus diisi' });
    }
    
    const password_hash = hashPasswordPythonStyle(password);
    // Convert empty email to NULL for proper UNIQUE constraint handling
    const emailValue = email && email.trim() ? email.trim() : null;

    db.run("INSERT INTO Guru (id_guru, username, password_hash, nama_guru, email) VALUES (?, ?, ?, ?, ?)",
        [id_guru, username, password_hash, nama_guru, emailValue],
        function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    if (err.message.includes('id_guru')) {
                        return res.status(409).json({ message: 'ID Guru (NIP) sudah ada.' });
                    }
                    return res.status(409).json({ message: 'Username atau email guru sudah ada.' });
                }
                return res.status(400).json({ message: err.message });
            }
            res.status(201).json({ message: 'Guru berhasil ditambahkan', id: id_guru });
        }
    );
};

exports.updateTeacher = (req, res) => {
    const { id } = req.params;
    const { username, password, nama_guru, email } = req.body;
    const db = getDb();
    // Convert empty email to NULL for proper UNIQUE constraint handling
    const emailValue = email && email.trim() ? email.trim() : null;
    
    let query = "UPDATE Guru SET username = ?, nama_guru = ?, email = ? WHERE id_guru = ?";
    let params = [username, nama_guru, emailValue, id];

    if (password) {
        const password_hash = hashPasswordPythonStyle(password);
        query = "UPDATE Guru SET username = ?, nama_guru = ?, email = ?, password_hash = ? WHERE id_guru = ?";
        params = [username, nama_guru, emailValue, password_hash, id];
    }

    db.run(query, params, function(err) {
        if (err) return res.status(400).json({ message: err.message });
        if (this.changes === 0) return res.status(404).json({ message: 'Guru tidak ditemukan atau tidak ada perubahan.' });
        res.json({ message: 'Guru berhasil diperbarui.' });
    });
};

exports.deleteTeacher = (req, res) => {
    const { id } = req.params;
    const db = getDb();

    db.get("SELECT COUNT(*) AS count FROM Kelas WHERE id_wali_kelas = ?", [id], (err, row) => {
        if (err) return res.status(500).json({ message: err.message });
        if (row.count > 0) {
            return res.status(409).json({ message: 'Tidak dapat menghapus guru. Guru masih menjadi wali kelas.' });
        }
        db.get("SELECT COUNT(*) AS count FROM GuruMataPelajaranKelas WHERE id_guru = ?", [id], (err, row) => {
            if (err) return res.status(500).json({ message: err.message });
            if (row.count > 0) {
                return res.status(409).json({ message: 'Tidak dapat menghapus guru. Guru masih memiliki penugasan mengajar.' });
            }
            db.get("SELECT COUNT(*) AS count FROM Nilai WHERE id_guru = ?", [id], (err, row) => {
                if (err) return res.status(500).json({ message: err.message });
                if (row.count > 0) {
                    return res.status(409).json({ message: 'Tidak dapat menghapus guru. Guru masih memiliki data nilai yang diinput.' });
                }
            db.get("SELECT COUNT(*) AS count FROM SiswaCapaianPembelajaran WHERE id_guru = ?", [id], (err, row) => {
                if (err) return res.status(500).json({ message: err.message });
                if (row.count > 0) {
                    return res.status(409).json({ message: 'Tidak dapat menghapus guru. Guru masih memiliki data capaian pembelajaran yang diinput.' });
                }

                    db.run("DELETE FROM Guru WHERE id_guru = ?", [id], function(err) {
                        if (err) return res.status(400).json({ message: err.message });
                        if (this.changes === 0) return res.status(404).json({ message: 'Guru tidak ditemukan.' });
                        res.json({ message: 'Guru berhasil dihapus.' });
                    });
                });
            });
        });
    });
};

// --- API Tambahan: Get Teacher Details for Admin ---
exports.getTeacherDetailsForAdmin = (req, res) => {
    const db = getDb();
    const query = `
        SELECT
            g.id_guru,
            g.username,
            g.nama_guru,
            g.email,
            GROUP_CONCAT(DISTINCT k_wali.nama_kelas || ' (' || tas_wali.tahun_ajaran || ' ' || tas_wali.semester || ')', '; ') AS wali_kelas_di,
            GROUP_CONCAT(DISTINCT mp.nama_mapel || ' di ' || k_ampu.nama_kelas || ' (' || tas_ampu.tahun_ajaran || ' ' || tas_ampu.semester || ')', '; ') AS mengampu_pelajaran_di
        FROM Guru g
        LEFT JOIN Kelas k_wali ON g.id_guru = k_wali.id_wali_kelas
        LEFT JOIN TahunAjaranSemester tas_wali ON k_wali.id_ta_semester = tas_wali.id_ta_semester
        LEFT JOIN GuruMataPelajaranKelas gmpk ON g.id_guru = gmpk.id_guru
        LEFT JOIN MataPelajaran mp ON gmpk.id_mapel = mp.id_mapel
        LEFT JOIN Kelas k_ampu ON gmpk.id_kelas = k_ampu.id_kelas
        LEFT JOIN TahunAjaranSemester tas_ampu ON gmpk.id_ta_semester = tas_ampu.id_ta_semester
        GROUP BY g.id_guru
        ORDER BY g.nama_guru;
    `;
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error("Error fetching teacher details for admin:", err.message);
            return res.status(500).json({ message: err.message });
        }
        res.json(rows);
    });
};


// --- Manajemen Tahun Ajaran & Semester ---
exports.getAllTASemester = (req, res) => {
    const db = getDb();
    db.all("SELECT * FROM TahunAjaranSemester ORDER BY tahun_ajaran DESC, semester DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(rows);
    });
};

exports.addTASemester = (req, res) => {
    const { tahun_ajaran, semester } = req.body;
    const db = getDb();
    
    // Default kelas untuk semester ganjil
    const defaultKelasNames = [
        '1 Darehdeh', '1 Gumujeng', '1 Someah',
        '2 Daria', '2 Gentur', '2 Rancage',
        '3 Calakan', '3 Rancingeus', '3 Singer',
        '4 Gumanti', '4 Jatmika', '4 Marahmay',
        '5 Binangkit', '5 Macakal', '5 Rucita',
        '6 Gumilang', '6 Parigel', '6 Sonagar'
    ];
    
    db.run("INSERT INTO TahunAjaranSemester (tahun_ajaran, semester) VALUES (?, ?)",
        [tahun_ajaran, semester],
        function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(409).json({ message: 'Tahun Ajaran & Semester ini sudah ada.' });
                }
                return res.status(400).json({ message: err.message });
            }
            
            const id_ta_semester = this.lastID;
            
            // Auto-create default kelas untuk semester Ganjil dan Genap
            if (semester === 'Ganjil' || semester === 'Genap') {
                let kelasCreated = 0;
                let kelasError = null;
                
                defaultKelasNames.forEach((kelasName, index) => {
                    db.run(
                        "INSERT INTO Kelas (nama_kelas, id_ta_semester) VALUES (?, ?)",
                        [kelasName, id_ta_semester],
                        function(err) {
                            if (err && !err.message.includes('UNIQUE constraint')) {
                                kelasError = err;
                            } else if (!err) {
                                kelasCreated++;
                            }
                            
                            // Jika semua kelas sudah diproses
                            if (index === defaultKelasNames.length - 1) {
                                if (kelasError) {
                                    console.error('Error creating default kelas:', kelasError);
                                    return res.status(500).json({ 
                                        message: 'Tahun Ajaran berhasil dibuat, tapi ada error saat membuat kelas default.',
                                        id: id_ta_semester,
                                        kelasCreated 
                                    });
                                }
                                res.status(201).json({ 
                                    message: `Tahun Ajaran & Semester berhasil ditambahkan. ${kelasCreated} kelas default telah dibuat.`, 
                                    id: id_ta_semester,
                                    kelasCreated 
                                });
                            }
                        }
                    );
                });
            } else {
                res.status(201).json({ 
                    message: 'Tahun Ajaran & Semester berhasil ditambahkan.',
                    id: id_ta_semester 
                });
            }
        }
    );
};

exports.setActiveTASemester = (req, res) => {
    const { id } = req.params;
    const db = getDb();
    db.serialize(() => { // Gunakan serialize untuk memastikan operasi berurutan
        db.run("UPDATE TahunAjaranSemester SET is_aktif = 0", [], (err) => {
            if (err) return res.status(500).json({ message: err.message });
            db.run("UPDATE TahunAjaranSemester SET is_aktif = 1 WHERE id_ta_semester = ?", [id], function(err) {
                if (err) return res.status(500).json({ message: err.message });
                if (this.changes === 0) return res.status(404).json({ message: 'Tahun Ajaran & Semester tidak ditemukan.' });
                res.json({ message: 'Tahun Ajaran & Semester berhasil diatur sebagai aktif.' });
            });
        });
    });
};

exports.deleteTASemester = (req, res) => {
    const { id } = req.params;
    const db = getDb();
    
    db.serialize(() => {
        // Cek apakah TASemester aktif
        db.get("SELECT is_aktif FROM TahunAjaranSemester WHERE id_ta_semester = ?", [id], (err, row) => {
            if (err) return res.status(500).json({ message: err.message });
            if (!row) return res.status(404).json({ message: 'Tahun Ajaran & Semester tidak ditemukan.' });
            
            if (row.is_aktif) {
                return res.status(409).json({ message: 'Tidak dapat menghapus Tahun Ajaran yang sedang aktif. Silakan set semester lain sebagai aktif terlebih dahulu.' });
            }
            
            // Delete semua data yang berhubungan (cascade)
            // 1. Delete Nilai (grades)
            db.run(`
                DELETE FROM Nilai WHERE id_ta_semester = ?
            `, [id], (err) => {
                if (err) return res.status(500).json({ message: err.message });
                
                // 2. Delete SiswaCapaianPembelajaran
                db.run("DELETE FROM SiswaCapaianPembelajaran WHERE id_ta_semester = ?", [id], (err) => {
                    if (err) return res.status(500).json({ message: err.message });
                    
                    // 3. Delete KKM_Settings
                    db.run("DELETE FROM KKM_Settings WHERE id_ta_semester = ?", [id], (err) => {
                        if (err) return res.status(500).json({ message: err.message });
                        
                        // 4. Delete manual_tp (if table exists)
                        db.run("DELETE FROM manual_tp WHERE id_ta_semester = ?", [id], (err) => {
                            // Ignore error if table doesn't exist
                            
                            // 5. Delete GuruMataPelajaranKelas (teacher assignments)
                            db.run("DELETE FROM GuruMataPelajaranKelas WHERE id_ta_semester = ?", [id], (err) => {
                                if (err) return res.status(500).json({ message: err.message });
                                
                                // 6. Delete SiswaKelas (student class enrollments)
                                db.run("DELETE FROM SiswaKelas WHERE id_ta_semester = ?", [id], (err) => {
                                    if (err) return res.status(500).json({ message: err.message });
                                    
                                    // 7. Delete Kelas (classes)
                                    db.run("DELETE FROM Kelas WHERE id_ta_semester = ?", [id], (err) => {
                                        if (err) return res.status(500).json({ message: err.message });
                                        
                                        // 8. Delete TahunAjaranSemester
                                        db.run("DELETE FROM TahunAjaranSemester WHERE id_ta_semester = ?", [id], function(err) {
                                            if (err) return res.status(500).json({ message: err.message });
                                            if (this.changes === 0) return res.status(404).json({ message: 'Tahun Ajaran & Semester tidak ditemukan.' });
                                            res.json({ message: 'Tahun Ajaran & Semester dan semua data terkait berhasil dihapus.' });
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });
};

// --- Manajemen Kelas ---
exports.getAllKelas = (req, res) => {
    const { id_ta_semester } = req.query; // Ambil dari query parameter
    const db = getDb();
    let query = `
        SELECT k.id_kelas, k.nama_kelas, g.nama_guru AS wali_kelas, tas.tahun_ajaran, tas.semester
        FROM Kelas k
        LEFT JOIN Guru g ON k.id_wali_kelas = g.id_guru
        JOIN TahunAjaranSemester tas ON k.id_ta_semester = tas.id_ta_semester
    `;
    let params = [];
    if (id_ta_semester) {
        query += ` WHERE k.id_ta_semester = ?`;
        params.push(id_ta_semester);
    }
    query += ` ORDER BY k.nama_kelas`;

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(rows);
    });
};

exports.addKelas = (req, res) => {
    const { nama_kelas, id_wali_kelas, id_ta_semester } = req.body;
    const db = getDb();
    db.run("INSERT INTO Kelas (nama_kelas, id_wali_kelas, id_ta_semester) VALUES (?, ?, ?)",
        [nama_kelas, id_wali_kelas, id_ta_semester],
        function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(409).json({ message: 'Kelas dengan nama ini sudah ada untuk semester ini.' });
                }
                return res.status(400).json({ message: err.message });
            }
            
            // If a homeroom teacher is assigned, auto-assign 5 core subjects
            if (id_wali_kelas) {
                autoAssignCoreSubjects(db, id_wali_kelas, this.lastID, (assignErr) => {
                    if (assignErr) {
                        console.error('Error auto-assigning core subjects:', assignErr);
                        // Don't fail the main operation, just log the error
                    }
                    res.status(201).json({ message: 'Kelas berhasil ditambahkan. Mata pelajaran wajib telah ditugaskan ke wali kelas.', id: this.lastID });
                });
            } else {
                res.status(201).json({ message: 'Kelas berhasil ditambahkan.', id: this.lastID });
            }
        }
    );
};

exports.updateKelas = (req, res) => { // Fungsi UPDATE kelas
    const { id } = req.params; // id_kelas
    const { nama_kelas, id_wali_kelas } = req.body; // id_ta_semester tidak diupdate di sini karena itu bagian dari unique key
    const db = getDb();

    // Update kelas data
    db.run("UPDATE Kelas SET nama_kelas = ?, id_wali_kelas = ? WHERE id_kelas = ?",
        [nama_kelas, id_wali_kelas, id],
        function(err) {
            if (err) return res.status(400).json({ message: err.message });
            if (this.changes === 0) return res.status(404).json({ message: 'Kelas tidak ditemukan atau tidak ada perubahan.' });
            
            // If a homeroom teacher is assigned, auto-assign 5 core subjects
            if (id_wali_kelas) {
                autoAssignCoreSubjects(db, id_wali_kelas, id, (assignErr) => {
                    if (assignErr) {
                        console.error('Error auto-assigning core subjects:', assignErr);
                        // Don't fail the main operation, just log the error
                    }
                    res.json({ message: 'Kelas berhasil diperbarui. Mata pelajaran wajib telah ditugaskan ke wali kelas.' });
                });
            } else {
                res.json({ message: 'Kelas berhasil diperbarui.' });
            }
        }
    );
};

// Helper function to auto-assign core subjects to homeroom teacher
function autoAssignCoreSubjects(db, id_guru, id_kelas, callback) {
    // Get current active semester
    db.get("SELECT id_ta_semester FROM TahunAjaranSemester WHERE is_aktif = 1", [], (err, activeSemester) => {
        if (err || !activeSemester) {
            return callback(new Error('No active semester found'));
        }

        const coreSubjects = [
            'BAHASA INDONESIA',
            'CITIZENSHIP', 
            'IPAS',
            'LIFE SKILLS',
            'MATEMATIKA'
        ];

        // Get subject IDs for core subjects
        const placeholders = coreSubjects.map(() => '?').join(',');
        db.all(`SELECT id_mapel, nama_mapel FROM MataPelajaran WHERE nama_mapel IN (${placeholders})`, 
            coreSubjects, (err, subjects) => {
            if (err) return callback(err);

            if (subjects.length === 0) {
                return callback(new Error('Core subjects not found in database'));
            }

            // Insert assignments for each core subject
            let completed = 0;
            let hasError = false;

            subjects.forEach(subject => {
                // Check if assignment already exists
                db.get(`SELECT id_guru_mapel_kelas FROM GuruMataPelajaranKelas 
                        WHERE id_guru = ? AND id_mapel = ? AND id_kelas = ? AND id_ta_semester = ?`,
                    [id_guru, subject.id_mapel, id_kelas, activeSemester.id_ta_semester], (err, existing) => {
                    
                    if (err) {
                        hasError = true;
                        return callback(err);
                    }

                    // Only insert if assignment doesn't already exist
                    if (!existing) {
                        db.run(`INSERT INTO GuruMataPelajaranKelas (id_guru, id_mapel, id_kelas, id_ta_semester) 
                                VALUES (?, ?, ?, ?)`,
                            [id_guru, subject.id_mapel, id_kelas, activeSemester.id_ta_semester], (err) => {
                            completed++;
                            if (err) hasError = true;
                            
                            if (completed === subjects.length) {
                                callback(hasError ? new Error('Some assignments failed') : null);
                            }
                        });
                    } else {
                        completed++;
                        if (completed === subjects.length) {
                            callback(null);
                        }
                    }
                });
            });
        });
    });
}

exports.deleteKelas = (req, res) => { // Fungsi DELETE kelas
    const { id } = req.params; // id_kelas
    const db = getDb();

    // Cek ketergantungan
    db.get("SELECT COUNT(*) AS count FROM SiswaKelas WHERE id_kelas = ?", [id], (err, row) => {
        if (err) return res.status(500).json({ message: err.message });
        if (row.count > 0) {
            return res.status(409).json({ message: 'Tidak dapat menghapus kelas. Kelas masih memiliki siswa terdaftar.' });
        }
        db.get("SELECT COUNT(*) AS count FROM GuruMataPelajaranKelas WHERE id_kelas = ?", [id], (err, row) => {
            if (err) return res.status(500).json({ message: err.message });
            if (row.count > 0) {
                return res.status(409).json({ message: 'Tidak dapat menghapus kelas. Kelas masih memiliki penugasan guru.' });
            }
            db.get("SELECT COUNT(*) AS count FROM Nilai WHERE id_kelas = ?", [id], (err, row) => {
                if (err) return res.status(500).json({ message: err.message });
                if (row.count > 0) {
                    return res.status(409).json({ message: 'Tidak dapat menghapus kelas. Kelas masih memiliki data nilai.' });
                }

                db.run("DELETE FROM Kelas WHERE id_kelas = ?", [id], function(err) {
                    if (err) return res.status(400).json({ message: err.message });
                    if (this.changes === 0) return res.status(404).json({ message: 'Kelas tidak ditemukan.' });
                    res.json({ message: 'Kelas berhasil dihapus.' });
                });
            });
        });
    });
};


// --- Manajemen Mata Pelajaran ---
exports.getAllMataPelajaran = (req, res) => {
    const db = getDb();
    db.all("SELECT * FROM MataPelajaran", [], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(rows);
    });
};

exports.addMataPelajaran = (req, res) => {
    const { nama_mapel } = req.body;
    const db = getDb();
    db.run("INSERT INTO MataPelajaran (nama_mapel) VALUES (?)",
        [nama_mapel],
        function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(409).json({ message: 'Mata Pelajaran ini sudah ada.' });
                }
                return res.status(400).json({ message: err.message });
            }
            res.status(201).json({ message: 'Mata Pelajaran berhasil ditambahkan.', id: this.lastID });
        }
    );
};

exports.updateMataPelajaran = (req, res) => { // Fungsi UPDATE mapel
    const { id } = req.params; // id_mapel
    const { nama_mapel } = req.body;
    const db = getDb();

    db.run("UPDATE MataPelajaran SET nama_mapel = ? WHERE id_mapel = ?",
        [nama_mapel, id],
        function(err) {
            if (err) return res.status(400).json({ message: err.message });
            if (this.changes === 0) return res.status(404).json({ message: 'Mata Pelajaran tidak ditemukan atau tidak ada perubahan.' });
            res.json({ message: 'Mata Pelajaran berhasil diperbarui.' });
        }
    );
};

exports.deleteMataPelajaran = (req, res) => { // Fungsi DELETE mapel
    const { id } = req.params; // id_mapel
    const db = getDb();

    // Cek ketergantungan
    db.get("SELECT COUNT(*) AS count FROM GuruMataPelajaranKelas WHERE id_mapel = ?", [id], (err, row) => {
        if (err) return res.status(500).json({ message: err.message });
        if (row.count > 0) {
            return res.status(409).json({ message: 'Tidak dapat menghapus mata pelajaran. Masih memiliki penugasan guru.' });
        }
        db.get("SELECT COUNT(*) AS count FROM Nilai WHERE id_mapel = ?", [id], (err, row) => {
            if (err) return res.status(500).json({ message: err.message });
            if (row.count > 0) {
                return res.status(409).json({ message: 'Tidak dapat menghapus mata pelajaran. Masih memiliki data nilai.' });
            }
            db.get("SELECT COUNT(*) AS count FROM CapaianPembelajaran WHERE id_mapel = ?", [id], (err, row) => {
                if (err) return res.status(500).json({ message: err.message });
                if (row.count > 0) {
                    return res.status(409).json({ message: 'Tidak dapat menghapus mata pelajaran. Masih memiliki capaian pembelajaran terkait.' });
                }

                db.run("DELETE FROM MataPelajaran WHERE id_mapel = ?", [id], function(err) {
                    if (err) return res.status(400).json({ message: err.message });
                    if (this.changes === 0) return res.status(404).json({ message: 'Mata Pelajaran tidak ditemukan.' });
                    res.json({ message: 'Mata Pelajaran berhasil dihapus.' });
                });
            });
        });
    });
};

// --- Manajemen Tipe Nilai ---
exports.getAllTipeNilai = (req, res) => {
    const db = getDb();
    db.all("SELECT * FROM TipeNilai", [], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(rows);
    });
};

exports.addTipeNilai = (req, res) => {
    const { nama_tipe, deskripsi } = req.body;
    const db = getDb();
    db.run("INSERT INTO TipeNilai (nama_tipe, deskripsi) VALUES (?, ?)",
        [nama_tipe, deskripsi],
        function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(409).json({ message: 'Tipe Nilai ini sudah ada.' });
                }
                return res.status(400).json({ message: err.message });
            }
            res.status(201).json({ message: 'Tipe Nilai berhasil ditambahkan.', id: this.lastID });
        }
    );
};

exports.updateTipeNilai = (req, res) => { // Fungsi UPDATE tipe nilai
    const { id } = req.params; // id_tipe_nilai
    const { nama_tipe, deskripsi } = req.body;
    const db = getDb();

    db.run("UPDATE TipeNilai SET nama_tipe = ?, deskripsi = ? WHERE id_tipe_nilai = ?",
        [nama_tipe, deskripsi, id],
        function(err) {
            if (err) return res.status(400).json({ message: err.message });
            if (this.changes === 0) return res.status(404).json({ message: 'Tipe Nilai tidak ditemukan atau tidak ada perubahan.' });
            res.json({ message: 'Tipe Nilai berhasil diperbarui.' });
        });
};

exports.deleteTipeNilai = (req, res) => { // Fungsi DELETE tipe nilai
    const { id } = req.params; // id_tipe_nilai
    const db = getDb();

    // Cek ketergantungan
    db.get("SELECT COUNT(*) AS count FROM Nilai WHERE id_tipe_nilai = ?", [id], (err, row) => {
        if (err) return res.status(500).json({ message: err.message });
        if (row.count > 0) {
            return res.status(409).json({ message: 'Tidak dapat menghapus tipe nilai. Masih digunakan dalam data nilai.' });
        }

        db.run("DELETE FROM TipeNilai WHERE id_tipe_nilai = ?", [id], function(err) {
            if (err) return res.status(400).json({ message: err.message });
            if (this.changes === 0) return res.status(404).json({ message: 'Tipe Nilai tidak ditemukan.' });
            res.json({ message: 'Tipe Nilai berhasil dihapus.' });
        });
    });
};


// --- Penugasan Siswa ke Kelas ---
exports.assignSiswaToKelas = (req, res) => {
    const { id_siswa, id_kelas, id_ta_semester } = req.body;
    const db = getDb();
    db.run("INSERT INTO SiswaKelas (id_siswa, id_kelas, id_ta_semester) VALUES (?, ?, ?)",
        [id_siswa, id_kelas, id_ta_semester],
        function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(409).json({ message: 'Siswa sudah terdaftar di kelas ini untuk semester ini.' });
                }
                return res.status(400).json({ message: err.message });
            }
            res.status(201).json({ message: 'Siswa berhasil ditugaskan ke kelas.', id: this.lastID });
        }
    );
};

exports.getSiswaInKelas = (req, res) => {
    const { id_kelas, id_ta_semester } = req.params;
    const db = getDb();
    db.all(`
        SELECT s.id_siswa, s.nama_siswa
        FROM SiswaKelas sk
        JOIN Siswa s ON sk.id_siswa = s.id_siswa
        WHERE sk.id_kelas = ? AND sk.id_ta_semester = ?
        ORDER BY s.nama_siswa
    `, [id_kelas, id_ta_semester], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(rows);
    });
};

exports.unassignSiswaFromKelas = (req, res) => {
    const { id_siswa, id_kelas, id_ta_semester } = req.body;
    const db = getDb();
    
    db.run(
        "DELETE FROM SiswaKelas WHERE id_siswa = ? AND id_kelas = ? AND id_ta_semester = ?",
        [id_siswa, id_kelas, id_ta_semester],
        function(err) {
            if (err) {
                return res.status(400).json({ message: err.message });
            }
            if (this.changes === 0) {
                return res.status(404).json({ message: 'Enrollment record not found or already removed.' });
            }
            res.json({ message: 'Student successfully removed from class.', changes: this.changes });
        }
    );
};

// --- Penugasan Guru ke Mata Pelajaran & Kelas ---
exports.assignGuruToMapelKelas = (req, res) => {
    const { id_guru, id_mapel, id_kelas, id_ta_semester, is_wali_kelas } = req.body;
    const db = getDb();
    
    // Start transaction
    db.serialize(() => {
        // Insert the assignment
        db.run("INSERT INTO GuruMataPelajaranKelas (id_guru, id_mapel, id_kelas, id_ta_semester) VALUES (?, ?, ?, ?)",
            [id_guru, id_mapel, id_kelas, id_ta_semester],
            function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(409).json({ message: 'Penugasan guru ini sudah ada.' });
                    }
                    return res.status(400).json({ message: err.message });
                }
                
                const assignmentId = this.lastID;
                
                // If is_wali_kelas is true, update the Kelas table
                if (is_wali_kelas) {
                    db.run("UPDATE Kelas SET id_wali_kelas = ? WHERE id_kelas = ?",
                        [id_guru, id_kelas],
                        function(updateErr) {
                            if (updateErr) {
                                // Rollback the assignment if wali kelas update fails
                                db.run("DELETE FROM GuruMataPelajaranKelas WHERE id_guru_mapel_kelas = ?", [assignmentId]);
                                return res.status(400).json({ message: 'Gagal mengatur wali kelas: ' + updateErr.message });
                            }
                            res.status(201).json({ 
                                message: 'Guru berhasil ditugaskan ke mata pelajaran dan kelas serta ditetapkan sebagai wali kelas.', 
                                id: assignmentId 
                            });
                        }
                    );
                } else {
                    res.status(201).json({ 
                        message: 'Guru berhasil ditugaskan ke mata pelajaran dan kelas.', 
                        id: assignmentId 
                    });
                }
            }
        );
    });
};

exports.getGuruMapelKelasAssignments = (req, res) => {
    const { id_ta_semester } = req.params;
    const db = getDb();
    db.all(`
        SELECT 
            gmpk.id_guru_mapel_kelas, 
            gmpk.id_guru, 
            g.nama_guru, 
            mp.nama_mapel, 
            k.nama_kelas, 
            tas.tahun_ajaran, 
            tas.semester,
            CASE WHEN k.id_wali_kelas = gmpk.id_guru THEN 1 ELSE 0 END as is_wali_kelas
        FROM GuruMataPelajaranKelas gmpk
        JOIN Guru g ON gmpk.id_guru = g.id_guru
        JOIN MataPelajaran mp ON gmpk.id_mapel = mp.id_mapel
        JOIN Kelas k ON gmpk.id_kelas = k.id_kelas
        JOIN TahunAjaranSemester tas ON gmpk.id_ta_semester = tas.id_ta_semester
        WHERE gmpk.id_ta_semester = ?
        ORDER BY g.nama_guru, k.nama_kelas, mp.nama_mapel
    `, [id_ta_semester], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(rows);
    });
};

exports.deleteGuruMapelKelasAssignment = (req, res) => {
    const { id } = req.params; // id_guru_mapel_kelas
    const db = getDb();

    // Check if assignment exists and get details for validation
    db.get("SELECT * FROM GuruMataPelajaranKelas WHERE id_guru_mapel_kelas = ?", [id], (err, assignment) => {
        if (err) return res.status(500).json({ message: err.message });
        if (!assignment) return res.status(404).json({ message: 'Assignment tidak ditemukan.' });

        // Check if there are any grades associated with this assignment
        db.get("SELECT COUNT(*) AS count FROM Nilai WHERE id_guru = ? AND id_mapel = ? AND id_kelas = ? AND id_ta_semester = ?", 
            [assignment.id_guru, assignment.id_mapel, assignment.id_kelas, assignment.id_ta_semester], (err, gradeCheck) => {
            if (err) return res.status(500).json({ message: err.message });
            
            if (gradeCheck.count > 0) {
                return res.status(409).json({ 
                    message: 'Tidak dapat menghapus assignment. Masih ada data nilai yang terkait dengan penugasan ini.' 
                });
            }

            // Check if this teacher is the wali kelas for this class
            db.get("SELECT id_wali_kelas FROM Kelas WHERE id_kelas = ?", [assignment.id_kelas], (err, kelas) => {
                if (err) return res.status(500).json({ message: err.message });
                
                const isWaliKelas = kelas && kelas.id_wali_kelas === assignment.id_guru;
                
                // Use transaction to ensure atomicity
                db.serialize(() => {
                    // Delete the assignment
                    db.run("DELETE FROM GuruMataPelajaranKelas WHERE id_guru_mapel_kelas = ?", [id], function(err) {
                        if (err) return res.status(400).json({ message: err.message });
                        if (this.changes === 0) return res.status(404).json({ message: 'Assignment tidak ditemukan.' });
                        
                        // If this guru was the wali kelas, check if they have any remaining assignments in this class
                        if (isWaliKelas) {
                            db.get(
                                "SELECT COUNT(*) AS count FROM GuruMataPelajaranKelas WHERE id_guru = ? AND id_kelas = ? AND id_ta_semester = ?",
                                [assignment.id_guru, assignment.id_kelas, assignment.id_ta_semester],
                                (err, remainingCheck) => {
                                    if (err) {
                                        console.error("Error checking remaining assignments:", err);
                                        return res.json({ message: 'Assignment berhasil dihapus.' });
                                    }
                                    
                                    // If no more assignments for this guru in this class, remove wali kelas
                                    if (remainingCheck.count === 0) {
                                        db.run("UPDATE Kelas SET id_wali_kelas = NULL WHERE id_kelas = ? AND id_wali_kelas = ?",
                                            [assignment.id_kelas, assignment.id_guru],
                                            (err) => {
                                                if (err) {
                                                    console.error("Error removing wali kelas:", err);
                                                }
                                                res.json({ 
                                                    message: 'Assignment berhasil dihapus. Wali kelas juga dihapus karena tidak ada assignment lagi.' 
                                                });
                                            }
                                        );
                                    } else {
                                        res.json({ message: 'Assignment berhasil dihapus.' });
                                    }
                                }
                            );
                        } else {
                            res.json({ message: 'Assignment berhasil dihapus.' });
                        }
                    });
                });
            });
        });
    });
};

exports.updateWaliKelas = (req, res) => {
    const { id_kelas } = req.params;
    const { id_guru } = req.body; // null to remove wali kelas, or id_guru to set new wali kelas
    const db = getDb();

    // Validate that the class exists
    db.get("SELECT * FROM Kelas WHERE id_kelas = ?", [id_kelas], (err, kelas) => {
        if (err) return res.status(500).json({ message: err.message });
        if (!kelas) return res.status(404).json({ message: 'Kelas tidak ditemukan.' });

        // If id_guru is provided, validate that the teacher exists
        if (id_guru !== null && id_guru !== undefined) {
            db.get("SELECT * FROM Guru WHERE id_guru = ?", [id_guru], (err, guru) => {
                if (err) return res.status(500).json({ message: err.message });
                if (!guru) return res.status(404).json({ message: 'Guru tidak ditemukan.' });

                // Get the 5 core subjects (Bahasa Indonesia, Matematika, IPA, Life Skills, Citizenship)
                const coreSubjects = ['Bahasa Indonesia', 'Matematika', 'IPAS', 'Life Skills', 'Citizenship'];
                
                // Build case-insensitive WHERE clause
                const whereClauses = coreSubjects.map(s => `UPPER(nama_mapel) = '${s.toUpperCase()}'`).join(' OR ');
                
                db.all(
                    `SELECT id_mapel FROM MataPelajaran WHERE ${whereClauses}`,
                    [],
                    (err, mapelList) => {
                        if (err) return res.status(500).json({ message: err.message });

                        // Update the wali kelas
                        db.run("UPDATE Kelas SET id_wali_kelas = ? WHERE id_kelas = ?", [id_guru, id_kelas], function(err) {
                            if (err) return res.status(400).json({ message: err.message });

                            // Auto-assign guru to core subjects for this class
                            let assignedCount = 0;
                            let successCount = 0;

                            if (mapelList.length > 0) {
                                mapelList.forEach((mapel) => {
                                    db.run(
                                        `INSERT INTO GuruMataPelajaranKelas (id_guru, id_mapel, id_kelas, id_ta_semester, is_wali_kelas)
                                         VALUES (?, ?, ?, ?, 1)
                                         ON CONFLICT(id_guru, id_mapel, id_kelas, id_ta_semester) DO UPDATE SET is_wali_kelas = 1`,
                                        [id_guru, mapel.id_mapel, id_kelas, kelas.id_ta_semester],
                                        function(err) {
                                            assignedCount++;
                                            if (!err) {
                                                successCount++;
                                            }

                                            // Send response after all assignments are processed
                                            if (assignedCount === mapelList.length) {
                                                res.json({ 
                                                    message: `Wali kelas berhasil diubah menjadi ${guru.nama_guru}. Auto-assigned ke ${successCount} mata pelajaran wajib.`,
                                                    assignedSubjects: successCount
                                                });
                                            }
                                        }
                                    );
                                });
                            } else {
                                // If core subjects not found, return warning
                                res.json({ 
                                    message: `Wali kelas berhasil diubah menjadi ${guru.nama_guru}. (Mata pelajaran wajib tidak ditemukan di database)`,
                                    assignedSubjects: 0
                                });
                            }
                        });
                    }
                );
            });
        } else {
            // Remove wali kelas (set to null)
            db.run("UPDATE Kelas SET id_wali_kelas = NULL WHERE id_kelas = ?", [id_kelas], function(err) {
                if (err) return res.status(400).json({ message: err.message });
                res.json({ message: 'Wali kelas berhasil dihapus dari kelas ini.' });
            });
        }
    });
};

// --- Capaian Pembelajaran (CP) ---
exports.getAllCapaianPembelajaran = (req, res) => {
    const { id_mapel } = req.query; // Filter by mapel if provided
    const db = getDb();
    let query = `
        SELECT cp.id_cp, cp.id_mapel, cp.fase, cp.deskripsi_cp, mp.nama_mapel
        FROM CapaianPembelajaran cp
        JOIN MataPelajaran mp ON cp.id_mapel = mp.id_mapel
    `;
    let params = [];
    if (id_mapel) {
        query += ` WHERE cp.id_mapel = ?`;
        params.push(id_mapel);
    }
    query += ` ORDER BY mp.nama_mapel, cp.fase`;

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(rows);
    });
};

exports.addCapaianPembelajaran = (req, res) => {
    const { id_mapel, fase, deskripsi_cp } = req.body;
    const db = getDb();
    db.run("INSERT INTO CapaianPembelajaran (id_mapel, fase, deskripsi_cp) VALUES (?, ?, ?)",
        [id_mapel, fase, deskripsi_cp],
        function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(409).json({ message: 'Fase ini sudah ada untuk mata pelajaran ini.' });
                }
                return res.status(400).json({ message: err.message });
            }
            res.status(201).json({ message: 'Capaian Pembelajaran berhasil ditambahkan.', id: this.lastID });
        }
    );
};

exports.updateCapaianPembelajaran = (req, res) => {
    const { id } = req.params; // id_cp
    const { deskripsi_cp } = req.body;
    const db = getDb();

    db.run("UPDATE CapaianPembelajaran SET deskripsi_cp = ? WHERE id_cp = ?",
        [deskripsi_cp, id],
        function(err) {
            if (err) return res.status(400).json({ message: err.message });
            if (this.changes === 0) return res.status(404).json({ message: 'Capaian Pembelajaran tidak ditemukan atau tidak ada perubahan.' });
            res.json({ message: 'Capaian Pembelajaran berhasil diperbarui.' });
        }
    );
};

exports.deleteCapaianPembelajaran = (req, res) => {
    const { id } = req.params; // id_cp
    const db = getDb();

    // Hapus data terkait terlebih dahulu (CASCADE DELETE manual)
    db.serialize(() => {
        // 1. Hapus data pencapaian siswa terkait CP ini
        db.run("DELETE FROM SiswaCapaianPembelajaran WHERE id_cp = ?", [id], (err) => {
            if (err) {
                console.error('Error deleting related student achievements:', err);
                return res.status(500).json({ message: 'Gagal menghapus data pencapaian siswa terkait: ' + err.message });
            }

            // 2. Hapus Capaian Pembelajaran itu sendiri
            db.run("DELETE FROM CapaianPembelajaran WHERE id_cp = ?", [id], function(err) {
                if (err) {
                    console.error('Error deleting CP:', err);
                    return res.status(400).json({ message: err.message });
                }
                if (this.changes === 0) {
                    return res.status(404).json({ message: 'Capaian Pembelajaran tidak ditemukan.' });
                }
                res.json({ 
                    message: 'Capaian Pembelajaran dan semua data terkait berhasil dihapus.',
                    deletedCP: true
                });
            });
        });
    });
};

// --- Manajemen Nilai Siswa (Admin) ---
exports.getAllGrades = (req, res) => { // Fungsi baru: Admin melihat semua nilai
    const db = getDb();
    // Query untuk mengambil semua nilai dengan detail siswa, guru, mapel, kelas, tipe nilai, TA/Semester
    const query = `
        SELECT
            n.id_nilai,
            s.nama_siswa,
            g.nama_guru,
            mp.nama_mapel,
            k.nama_kelas,
            tas.tahun_ajaran,
            tas.semester,
            tn.nama_tipe,
            n.nilai,
            n.tanggal_input,
            n.keterangan,
            n.id_guru, -- Tambahkan id_guru untuk keperluan request perubahan
            n.id_siswa,
            n.id_mapel,
            n.id_kelas,
            n.id_ta_semester,
            n.id_tipe_nilai
        FROM Nilai n
        JOIN Siswa s ON n.id_siswa = s.id_siswa
        JOIN Guru g ON n.id_guru = g.id_guru
        JOIN MataPelajaran mp ON n.id_mapel = mp.id_mapel
        JOIN Kelas k ON n.id_kelas = k.id_kelas
        JOIN TahunAjaranSemester tas ON n.id_ta_semester = tas.id_ta_semester
        JOIN TipeNilai tn ON n.id_tipe_nilai = tn.id_tipe_nilai
        ORDER BY tas.tahun_ajaran DESC, tas.semester DESC, k.nama_kelas, s.nama_siswa, mp.nama_mapel, tn.nama_tipe
    `;
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error("Error fetching all grades for admin:", err.message);
            return res.status(500).json({ message: err.message });
        }
        res.json(rows);
    });
};

exports.createGradeChangeRequest = (req, res) => { // Fungsi baru: Admin membuat permintaan perubahan nilai
    const { id_nilai, id_admin_requestor, id_guru_approver, nilai_lama, nilai_baru, catatan_admin } = req.body;
    const db = getDb();
    const tanggal_request = format(new Date(), 'yyyy-MM-dd HH:mm:ss');

    db.run(`
        INSERT INTO GradeChangeRequest (id_nilai, id_admin_requestor, id_guru_approver, nilai_lama, nilai_baru, tanggal_request, status_request, catatan_admin)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [id_nilai, id_admin_requestor, id_guru_approver, nilai_lama, nilai_baru, tanggal_request, 'Pending', catatan_admin], function(err) {
        if (err) {
            console.error("Error creating grade change request:", err.message);
            return res.status(400).json({ message: err.message });
        }
        res.status(201).json({ message: 'Permintaan perubahan nilai berhasil diajukan.', id: this.lastID });
    });
};

// --- Kenaikan Kelas Siswa ---
exports.promoteStudents = (req, res) => {
    const { student_ids, target_kelas_id, target_ta_semester_id } = req.body;
    const db = getDb();
    let insertedCount = 0;
    let failedCount = 0;

    console.log('📋 Promote request received:', {
        studentCount: student_ids ? student_ids.length : 0,
        targetClass: target_kelas_id,
        targetSemester: target_ta_semester_id,
        studentIds: student_ids
    });

    if (!student_ids || !Array.isArray(student_ids) || student_ids.length === 0) {
        return res.status(400).json({ message: 'student_ids harus berupa array yang tidak kosong' });
    }

    if (!target_kelas_id || !target_ta_semester_id) {
        return res.status(400).json({ message: 'target_kelas_id dan target_ta_semester_id diperlukan' });
    }

    // Menggunakan Promise.all untuk menangani operasi database asinkron dalam loop
    const promises = student_ids.map(id_siswa => {
        return new Promise((resolve, reject) => {
            // Insert into new class while keeping old records for history/tracking
            db.run("INSERT INTO SiswaKelas (id_siswa, id_kelas, id_ta_semester) VALUES (?, ?, ?)",
                [id_siswa, target_kelas_id, target_ta_semester_id],
                function(err) {
                    if (err) {
                        if (err.message.includes('UNIQUE constraint failed')) {
                            // Siswa sudah terdaftar di kelas tujuan
                            console.warn(`⚠️ Student ${id_siswa} sudah terdaftar di kelas ${target_kelas_id} semester ${target_ta_semester_id}`);
                            failedCount++;
                            resolve(); // Tetap resolve agar Promise.all bisa lanjut
                        } else {
                            console.error(`❌ Error promoting student ${id_siswa}:`, err.message);
                            failedCount++;
                            reject(err);
                        }
                    } else {
                        console.log(`✅ Student ${id_siswa} promoted successfully`);
                        insertedCount++;
                        resolve();
                    }
                }
            );
        });
    });

    Promise.all(promises)
        .then(() => {
            const message = `Berhasil mempromosikan ${insertedCount} siswa. ${failedCount} siswa gagal atau sudah ada.`;
            console.log('🎉 Promotion complete:', { insertedCount, failedCount });
            res.status(200).json({
                message,
                insertedCount,
                failedCount
            });
        })
        .catch(error => {
            console.error('💥 Promotion error:', error);
            res.status(500).json({ message: 'Gagal mempromosikan siswa: ' + error.message });
        });
};
