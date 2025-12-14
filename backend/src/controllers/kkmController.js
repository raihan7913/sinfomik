const { getDb } = require('../config/db');

/**
 * Save atau Update KKM Settings
 * POST /api/kkm/save
 * Body: {
 *   id_guru, id_mapel, id_kelas, id_ta_semester,
 *   kkmSettings: { TP1: 75, TP2: 80, UAS: 75, FINAL: 75 }
 * }
 */
exports.saveKkmSettings = async (req, res) => {
    try {
        const { id_guru, id_mapel, id_kelas, id_ta_semester, kkmSettings } = req.body;
        
        if (!id_guru || !id_mapel || !id_kelas || !id_ta_semester || !kkmSettings) {
            return res.status(400).json({ message: 'Parameter tidak lengkap' });
        }
        
        const db = getDb();
        let successCount = 0;
        let failCount = 0;
        const errors = [];
        
        // Process each KKM setting
        for (const [key, value] of Object.entries(kkmSettings)) {
            if (value === null || value === undefined || value === '') {
                continue; // Skip empty values
            }
            
            const nilai_kkm = parseFloat(value);
            
            if (isNaN(nilai_kkm) || nilai_kkm < 0 || nilai_kkm > 100) {
                errors.push(`KKM ${key} tidak valid: ${value}`);
                failCount++;
                continue;
            }
            
            let jenis_nilai, urutan_tp;
            
            // Parse key: "TP1", "TP2", "UAS", "FINAL"
            if (key.startsWith('TP')) {
                jenis_nilai = 'TP';
                urutan_tp = parseInt(key.replace('TP', ''));
            } else if (key === 'UAS') {
                jenis_nilai = 'UAS';
                urutan_tp = null;
            } else if (key === 'FINAL') {
                jenis_nilai = 'FINAL';
                urutan_tp = null;
            } else {
                errors.push(`Jenis nilai tidak dikenali: ${key}`);
                failCount++;
                continue;
            }
            
            try {
                await new Promise((resolve, reject) => {
                    db.run(
                        `INSERT INTO kkm_settings (id_guru, id_mapel, id_kelas, id_ta_semester, jenis_nilai, urutan_tp, nilai_kkm, tanggal_update)
                         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
                         ON CONFLICT(id_guru, id_mapel, id_kelas, id_ta_semester, jenis_nilai, urutan_tp)
                         DO UPDATE SET nilai_kkm = excluded.nilai_kkm, tanggal_update = NOW()`,
                        [id_guru, id_mapel, id_kelas, id_ta_semester, jenis_nilai, urutan_tp, nilai_kkm],
                        function(err) {
                            if (err) reject(err);
                            else resolve();
                        }
                    );
                });
                successCount++;
            } catch (err) {
                errors.push(`Gagal menyimpan KKM ${key}: ${err.message}`);
                failCount++;
            }
        }
        
        res.status(200).json({
            message: `KKM berhasil disimpan. Sukses: ${successCount}, Gagal: ${failCount}`,
            success: successCount,
            failed: failCount,
            errors: errors
        });
        
    } catch (err) {
        console.error('Error saving KKM:', err);
        res.status(500).json({ 
            message: 'Gagal menyimpan KKM', 
            error: err.message 
        });
    }
};

/**
 * Get KKM Settings
 * GET /api/kkm/:id_guru/:id_mapel/:id_kelas/:id_ta_semester
 */
exports.getKkmSettings = async (req, res) => {
    try {
        const { id_guru, id_mapel, id_kelas, id_ta_semester } = req.params;
        
        if (!id_guru || !id_mapel || !id_kelas || !id_ta_semester) {
            return res.status(400).json({ message: 'Parameter tidak lengkap' });
        }
        
        const db = getDb();
        
        const kkmData = await new Promise((resolve, reject) => {
            db.all(
                `SELECT jenis_nilai, urutan_tp, nilai_kkm 
                 FROM kkm_settings 
                 WHERE id_guru = ? AND id_mapel = ? AND id_kelas = ? AND id_ta_semester = ?
                 ORDER BY jenis_nilai, urutan_tp`,
                [id_guru, id_mapel, id_kelas, id_ta_semester],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
        
        // Convert to object format: { TP1: 75, TP2: 80, UAS: 75, FINAL: 75 }
        const kkmSettings = {};
        
        kkmData.forEach(row => {
            if (row.jenis_nilai === 'TP') {
                kkmSettings[`TP${row.urutan_tp}`] = row.nilai_kkm;
            } else {
                kkmSettings[row.jenis_nilai] = row.nilai_kkm;
            }
        });
        
        res.status(200).json({
            success: true,
            data: kkmSettings
        });
        
    } catch (err) {
        console.error('Error getting KKM:', err);
        res.status(500).json({ 
            message: 'Gagal mengambil KKM', 
            error: err.message 
        });
    }
};

/**
 * Delete KKM Settings untuk assignment tertentu
 * DELETE /api/kkm/:id_guru/:id_mapel/:id_kelas/:id_ta_semester
 */
exports.deleteKkmSettings = async (req, res) => {
    try {
        const { id_guru, id_mapel, id_kelas, id_ta_semester } = req.params;
        
        if (!id_guru || !id_mapel || !id_kelas || !id_ta_semester) {
            return res.status(400).json({ message: 'Parameter tidak lengkap' });
        }
        
        const db = getDb();
        
        await new Promise((resolve, reject) => {
            db.run(
                `DELETE FROM kkm_settings 
                 WHERE id_guru = ? AND id_mapel = ? AND id_kelas = ? AND id_ta_semester = ?`,
                [id_guru, id_mapel, id_kelas, id_ta_semester],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });
        
        res.status(200).json({
            message: 'KKM settings berhasil dihapus',
            success: true
        });
        
    } catch (err) {
        console.error('Error deleting KKM:', err);
        res.status(500).json({ 
            message: 'Gagal menghapus KKM', 
            error: err.message 
        });
    }
};
