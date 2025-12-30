const xlsx = require('xlsx');
const { getDb } = require('../config/db');
const fs = require('fs');
const path = require('path');

exports.importCapaianPembelajaran = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Mohon upload file Excel' });
        }

        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        
        // Convert Excel ke JSON dengan header: 1 untuk mendapatkan array 2D
        // data[row][col] - ingat bahwa index dimulai dari 0
        const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        
        /* 
        Format Excel yang diharapkan:
        Baris 2 (index 1): CAPAIAN PEMBELAJARAN CITIZENSHIP
        Baris 3 (index 2): TAHUN AJARAN 2025/2026
        Baris 5 (index 4): [Header Fase A] [Header Fase B] [Header Fase C]
        Baris 6 (index 5): [Deskripsi A] [Deskripsi B] [Deskripsi C]
        */
        
        const db = getDb();
        const results = {
            success: 0,
            failed: 0,
            errors: []
        };

        // Baca judul di sel A2 (baris 2 kolom 1) -> data[1][0]
        const titleRow = data[1] && data[1][0] ? data[1][0] : null; // "CAPAIAN PEMBELAJARAN CITIZENSHIP" or "CAPAIAN PEMBELAJARAN Life Skills"
        if (!titleRow) {
            throw new Error('Judul file Excel tidak ditemukan. Pastikan format file sesuai (Baris 2 berisi "CAPAIAN PEMBELAJARAN <Mapel>").');
        }
        
        // Extract mapel name: remove "CAPAIAN PEMBELAJARAN " prefix
        // Handle both single word (CITIZENSHIP) and multi-word (Life Skills) subjects
        const mapelName = titleRow
            .replace(/^CAPAIAN PEMBELAJARAN\s+/i, '') // Remove prefix (case insensitive)
            .trim();

        console.log(`[IMPORT-CP] Detected mapelName: "${mapelName}"`);
        
        // Dapatkan id_mapel
        try {
            console.log('[IMPORT-CP] Import request by user:', req.user ? `${req.user.user_type}/${req.user.id}` : 'anonymous');
            console.log('[IMPORT-CP] Uploaded file:', req.file ? req.file.originalname : '(no file)');
            // Case-insensitive lookup because Excel might contain different casing/spacing
            const mapelRow = await new Promise((resolve, reject) => {
                db.get(
                    "SELECT id_mapel FROM MataPelajaran WHERE LOWER(nama_mapel) = LOWER(?)",
                    [mapelName.trim()],
                    (err, row) => {
                        if (err) {
                            console.error('Error while querying MataPelajaran:', err.message);
                            return reject(err);
                        }
                        resolve(row);
                    }
                );
            });

            if (!mapelRow) {
                // Get available subjects for better error message
                const availableMapel = await new Promise((resolve, reject) => {
                    db.all("SELECT nama_mapel FROM MataPelajaran ORDER BY nama_mapel", [], (err, rows) => {
                        if (err) reject(err);
                        resolve(rows || []);
                    });
                });
                
                const mapelList = availableMapel.map(m => m.nama_mapel).join(', ');
                throw new Error(`Mata pelajaran "${mapelName}" tidak ditemukan di database. Mata pelajaran yang tersedia: ${mapelList}. Pastikan nama mata pelajaran di Excel sesuai dengan database.`);
            }

            const id_mapel = mapelRow.id_mapel;

            // Simpan file Excel ke folder uploads
            const uploadsDir = path.join(__dirname, '../../uploads');
            if (!fs.existsSync(uploadsDir)) {
                fs.mkdirSync(uploadsDir, { recursive: true });
            }

            // Buat nama file unik dengan timestamp
            const timestamp = Date.now();
            const fileName = `cp_${mapelName.toLowerCase().replace(/\s+/g, '_')}_${timestamp}.xlsx`;
            const filePath = path.join(uploadsDir, fileName);
            
            // Simpan file
            fs.writeFileSync(filePath, req.file.buffer);
            
            // Simpan relative path untuk database
            const relativeFilePath = `uploads/${fileName}`;

            // Validasi format Excel
            if (!data[4] || !data[5]) {
                throw new Error('Format Excel tidak sesuai. Pastikan ada header fase di baris 5 dan deskripsi di baris 6');
            }

            // Baca header fase di baris 5 (index 4)
            const headerRow = data[4]; // ["Fase A" / "FASE A" / "A", "Fase B" / "B", "Fase C" / "C"]
            
            // Mapping kolom ke fase berdasarkan header
            const faseMapping = {}; // { 'A': columnIndex, 'B': columnIndex, 'C': columnIndex }
            
            headerRow.forEach((header, colIndex) => {
                if (header && typeof header === 'string') {
                    const headerUpper = header.toString().toUpperCase().trim();
                    
                    // Deteksi fase A, B, atau C dari header
                    if (headerUpper.includes('FASE A') || headerUpper === 'A') {
                        faseMapping['A'] = colIndex;
                    } else if (headerUpper.includes('FASE B') || headerUpper === 'B') {
                        faseMapping['B'] = colIndex;
                    } else if (headerUpper.includes('FASE C') || headerUpper === 'C') {
                        faseMapping['C'] = colIndex;
                    }
                }
            });
            
            if (Object.keys(faseMapping).length === 0) {
                throw new Error('Tidak ditemukan header fase (A/B/C) di baris 5. Pastikan ada kolom dengan header "Fase A", "Fase B", atau "Fase C"');
            }

            // Proses setiap fase yang terdeteksi
            for (const [fase, colIndex] of Object.entries(faseMapping)) {
                // Baca deskripsi dari baris 6 (index 5) di kolom yang sesuai
                const deskripsi = data[5][colIndex];

                if (deskripsi && deskripsi.toString().trim()) {
                    try {
                        await new Promise((resolve, reject) => {
                            db.run(
                                `INSERT INTO CapaianPembelajaran (id_mapel, fase, deskripsi_cp, file_path)
                                VALUES (?, ?, ?, ?)
                                ON CONFLICT(id_mapel, fase) 
                                DO UPDATE SET deskripsi_cp = ?, file_path = ?`,
                                [id_mapel, fase, deskripsi, relativeFilePath, deskripsi, relativeFilePath],
                                function(err) {
                                    if (err) reject(err);
                                    results.success++;
                                    resolve();
                                }
                            );
                        });
                    } catch (err) {
                        results.failed++;
                        results.errors.push(`Error pada fase ${fase}: ${err.message}`);
                    }
                }
            }

            res.json({
                message: `Import berhasil. ${results.success} CP diperbarui.`,
                details: results
            });

        } catch (err) {
            throw new Error(`Error memproses mata pelajaran: ${err.message}`);
        }

    } catch (err) {
        console.error('Error importing excel:', err);
        res.status(500).json({ 
            message: 'Gagal memproses file Excel', 
            error: err.message 
        });
    }
};

exports.getAtpByFase = async (req, res) => {
    try {
        const { id_mapel, fase } = req.params;
        
        const db = getDb();
        
        // Ambil file_path dari database
        const cpRow = await new Promise((resolve, reject) => {
            db.get(
                `SELECT cp.file_path, m.nama_mapel 
                 FROM CapaianPembelajaran cp
                 JOIN MataPelajaran m ON cp.id_mapel = m.id_mapel
                 WHERE cp.id_mapel = ? AND cp.fase = ?`,
                [id_mapel, fase],
                (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                }
            );
        });

        if (!cpRow || !cpRow.file_path) {
            return res.status(404).json({ 
                message: 'File Excel tidak ditemukan untuk mata pelajaran dan fase ini' 
            });
        }

        // Baca file Excel
        const filePath = path.join(__dirname, '../../', cpRow.file_path);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ 
                message: 'File Excel tidak ditemukan di server' 
            });
        }

        const workbook = xlsx.readFile(filePath);
        
        // Cari sheet yang sesuai dengan fase
        // Format nama sheet: "ATP [NamaMapel] Fase [A/B/C]"
        // Cari dengan case-insensitive
        const targetSheetName = `ATP ${cpRow.nama_mapel} Fase ${fase}`;
        const sheetName = workbook.SheetNames.find(name => 
            name.toLowerCase() === targetSheetName.toLowerCase()
        );
        
        if (!sheetName) {
            return res.status(404).json({ 
                message: `Sheet "ATP ${cpRow.nama_mapel} Fase ${fase}" tidak ditemukan di file Excel`,
                availableSheets: workbook.SheetNames
            });
        }

        const sheet = workbook.Sheets[sheetName];
        
        // Convert sheet ke JSON dengan header di baris 5 (index 4)
        const data = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        
        // Header ada di baris 5 (index 4): ["Elemen", "CP", "TP", "KKTP", "Materi Pokok", "Kelas", "Semester"]
        // Data mulai dari baris 6 (index 5)
        const headers = data[4] || [];
        const rows = data.slice(5); // Mulai dari baris 6
        
        // Convert ke format array of objects
        const atpData = rows
            .filter(row => row.some(cell => cell !== '')) // Filter baris kosong
            .map(row => {
                const obj = {};
                headers.forEach((header, idx) => {
                    obj[header] = row[idx] || '';
                });
                return obj;
            });

        res.json({
            success: true,
            mapel: cpRow.nama_mapel,
            fase: fase,
            sheetName: sheetName,
            headers: headers,
            data: atpData,
            totalRows: atpData.length
        });

    } catch (err) {
        console.error('Error reading ATP:', err);
        res.status(500).json({ 
            message: 'Gagal membaca data ATP', 
            error: err.message 
        });
    }
};

/**
 * Update ATP data in Excel file
 * PUT /api/excel/atp/:id_mapel/:fase
 * Body: { data: [{ Elemen, CP, TP, KKTP, "Materi Pokok", Kelas, Semester }, ...] }
 */
exports.updateAtpByFase = async (req, res) => {
    try {
        const { id_mapel, fase } = req.params;
        const { data: updatedData } = req.body;

        if (!updatedData || !Array.isArray(updatedData)) {
            return res.status(400).json({ 
                message: 'Data ATP tidak valid. Expected array of objects.' 
            });
        }

        const db = getDb();
        
        // Ambil file_path dari database
        const cpRow = await new Promise((resolve, reject) => {
            db.get(
                `SELECT cp.file_path, m.nama_mapel 
                 FROM CapaianPembelajaran cp
                 JOIN MataPelajaran m ON cp.id_mapel = m.id_mapel
                 WHERE cp.id_mapel = ? AND cp.fase = ?`,
                [id_mapel, fase],
                (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                }
            );
        });

        if (!cpRow || !cpRow.file_path) {
            return res.status(404).json({ 
                message: 'File Excel tidak ditemukan untuk mata pelajaran dan fase ini' 
            });
        }

        // Baca file Excel
        const filePath = path.join(__dirname, '../../', cpRow.file_path);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ 
                message: 'File Excel tidak ditemukan di server' 
            });
        }

        // Read workbook
        const workbook = xlsx.readFile(filePath);
        
        // Cari sheet yang sesuai dengan fase
        const targetSheetName = `ATP ${cpRow.nama_mapel} Fase ${fase}`;
        const sheetName = workbook.SheetNames.find(name => 
            name.toLowerCase() === targetSheetName.toLowerCase()
        );
        
        if (!sheetName) {
            return res.status(404).json({ 
                message: `Sheet "ATP ${cpRow.nama_mapel} Fase ${fase}" tidak ditemukan di file Excel`,
                availableSheets: workbook.SheetNames
            });
        }

        const sheet = workbook.Sheets[sheetName];
        
        // Convert sheet ke JSON dengan header di baris 5 (index 4)
        const data = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        
        // Header ada di baris 5 (index 4)
        const headers = data[4] || [];
        
        // Validasi: pastikan semua kolom dari updatedData ada di headers
        const firstRow = updatedData[0];
        if (firstRow) {
            const incomingKeys = Object.keys(firstRow);
            const missingKeys = incomingKeys.filter(key => !headers.includes(key));
            if (missingKeys.length > 0) {
                return res.status(400).json({ 
                    message: 'Kolom tidak valid dalam data',
                    missingKeys: missingKeys,
                    validHeaders: headers
                });
            }
        }

        // Update data rows (mulai dari index 5, karena index 0-4 adalah header/metadata)
        const newRows = updatedData.map(rowData => {
            return headers.map(header => rowData[header] || '');
        });

        // Gabungkan metadata (baris 0-4) dengan data baru (baris 5+)
        const updatedSheetData = [
            ...data.slice(0, 5), // Keep header rows (index 0-4)
            ...newRows            // New data rows (index 5+)
        ];

        // Convert array kembali ke sheet
        const newSheet = xlsx.utils.aoa_to_sheet(updatedSheetData);
        
        // Replace sheet di workbook
        workbook.Sheets[sheetName] = newSheet;

        // Save file Excel
        xlsx.writeFile(workbook, filePath);

        res.json({
            success: true,
            message: 'ATP berhasil diupdate',
            mapel: cpRow.nama_mapel,
            fase: fase,
            rowsUpdated: newRows.length
        });

    } catch (err) {
        console.error('Error updating ATP:', err);
        res.status(500).json({ 
            message: 'Gagal mengupdate ATP', 
            error: err.message 
        });
    }
};

/**
 * Get TP (Tujuan Pembelajaran) by Mapel, Fase, Kelas, and Semester
 * Filter ATP berdasarkan tingkat kelas dan semester aktif
 */
exports.getTpByMapelFaseKelas = async (req, res) => {
    try {
        const { id_mapel, fase, id_kelas } = req.params;
        const { semester } = req.query; // Get semester from query parameter (1 = Ganjil, 2 = Genap)
        
        const db = getDb();
        
        // Ambil nama kelas dan id_ta_semester untuk validasi
        const kelasRow = await new Promise((resolve, reject) => {
            db.get(
                'SELECT k.nama_kelas, k.id_ta_semester, tas.semester FROM Kelas k LEFT JOIN TahunAjaranSemester tas ON k.id_ta_semester = tas.id_ta_semester WHERE k.id_kelas = ?',
                [id_kelas],
                (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                }
            );
        });

        if (!kelasRow) {
            return res.status(404).json({ 
                message: 'Kelas tidak ditemukan' 
            });
        }

        // Determine semester filter
        let semesterFilter = null;
        if (semester) {
            semesterFilter = parseInt(semester);
        } else if (kelasRow.semester) {
            // Auto-detect from kelas's semester (Ganjil = 1, Genap = 2)
            semesterFilter = kelasRow.semester.toLowerCase() === 'ganjil' ? 1 : 2;
        }

        // Ekstrak tingkat kelas dari nama_kelas
        // Misal: "1 Gumujeng" -> tingkat = 1, "2 A" -> tingkat = 2
        const match = kelasRow.nama_kelas.match(/^(\d+)/);
        if (!match) {
            return res.status(400).json({ 
                message: 'Format nama kelas tidak valid (harus diawali angka)',
                nama_kelas: kelasRow.nama_kelas
            });
        }
        
        const tingkatKelas = parseInt(match[1]);
        
        // Ambil file_path dari database
        const cpRow = await new Promise((resolve, reject) => {
            db.get(
                `SELECT cp.file_path, m.nama_mapel 
                 FROM CapaianPembelajaran cp
                 JOIN MataPelajaran m ON cp.id_mapel = m.id_mapel
                 WHERE cp.id_mapel = ? AND cp.fase = ?`,
                [id_mapel, fase],
                (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                }
            );
        });

        if (!cpRow || !cpRow.file_path) {
            return res.status(404).json({ 
                message: 'File Excel tidak ditemukan untuk mata pelajaran dan fase ini' 
            });
        }

        // Baca file Excel
        const filePath = path.join(__dirname, '../../', cpRow.file_path);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ 
                message: 'File Excel tidak ditemukan di server' 
            });
        }

        const workbook = xlsx.readFile(filePath);
        
        // Cari sheet yang sesuai dengan fase
        const targetSheetName = `ATP ${cpRow.nama_mapel} Fase ${fase}`;
        const sheetName = workbook.SheetNames.find(name => 
            name.toLowerCase() === targetSheetName.toLowerCase()
        );
        
        if (!sheetName) {
            return res.status(404).json({ 
                message: `Sheet "ATP ${cpRow.nama_mapel} Fase ${fase}" tidak ditemukan di file Excel`,
                availableSheets: workbook.SheetNames
            });
        }

        const sheet = workbook.Sheets[sheetName];
        
        // Convert sheet ke JSON dengan header di baris 5 (index 4)
        const data = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        
        // Header ada di baris 5 (index 4)
        const headers = data[4] || [];
        const rows = data.slice(5); // Data mulai dari baris 6
        
        // Find index kolom yang relevan
        const tpIndex = headers.findIndex(h => 
            h && h.toString().toLowerCase().includes('tujuan pembelajaran')
        );
        const kelasIndex = headers.findIndex(h => 
            h && h.toString().toLowerCase() === 'kelas'
        );
        const semesterIndex = headers.findIndex(h => 
            h && h.toString().toLowerCase() === 'semester'
        );
        const kktpIndex = headers.findIndex(h => 
            h && h.toString().toLowerCase().includes('kktp')
        );

        if (tpIndex === -1 || kelasIndex === -1) {
            return res.status(500).json({ 
                message: 'Struktur Excel tidak valid (kolom TP atau Kelas tidak ditemukan)',
                headers: headers
            });
        }

        // Filter TP berdasarkan tingkat kelas DAN semester
        const tpList = rows
            .filter(row => {
                // Filter: kelas harus sesuai dan TP tidak kosong
                const kelasExcel = row[kelasIndex];
                const tpText = row[tpIndex];
                const semesterExcel = row[semesterIndex];
                
                // Basic filters: kelas dan TP tidak kosong
                const basicMatch = kelasExcel && 
                       parseInt(kelasExcel) === tingkatKelas && 
                       tpText && 
                       tpText.toString().trim() !== '';
                
                // Semester filter (jika ada)
                if (semesterFilter && semesterIndex !== -1 && semesterExcel) {
                    const semesterStr = semesterExcel.toString().trim();
                    
                    // Cek berbagai format multi-semester:
                    // "1 dan 2", "1,2", "1-2", "1, 2", "1 & 2", "1/2"
                    const semesterMatches = semesterStr.match(/\d+/g); // Extract semua angka
                    
                    if (semesterMatches) {
                        // Konversi ke array of integers
                        const semesterNumbers = semesterMatches.map(s => parseInt(s));
                        // Check apakah semesterFilter ada di dalam list
                        return basicMatch && semesterNumbers.includes(semesterFilter);
                    }
                    
                    // Fallback ke parseInt biasa jika tidak ada match
                    return basicMatch && parseInt(semesterExcel) === semesterFilter;
                }
                
                return basicMatch;
            })
            .map((row, index) => ({
                urutan_tp: index + 1,
                tujuan_pembelajaran: row[tpIndex],
                semester: row[semesterIndex] || null,
                kktp: row[kktpIndex] || null,
                kelas_excel: row[kelasIndex]
            }));

        res.json({
            success: true,
            mapel: cpRow.nama_mapel,
            fase: fase,
            nama_kelas: kelasRow.nama_kelas,
            tingkat_kelas: tingkatKelas,
            semester_filter: semesterFilter,
            semester_text: semesterFilter === 1 ? 'Ganjil' : semesterFilter === 2 ? 'Genap' : 'Semua',
            total_tp: tpList.length,
            tp_list: tpList
        });

    } catch (err) {
        console.error('Error reading TP:', err);
        res.status(500).json({ 
            message: 'Gagal membaca data TP', 
            error: err.message 
        });
    }
};

/**
 * Export template Excel untuk import siswa
 * GET /api/excel/students/template
 */
exports.exportStudentTemplate = async (req, res) => {
    try {
        // Create workbook
        const wb = xlsx.utils.book_new();
        
        // Header columns (added 'Tahun Ajaran' which accepts single-year like 2024 or full '2024/2025')
        const headers = ['NIS', 'Nama Siswa', 'Tanggal Lahir', 'Jenis Kelamin', 'Tahun Ajaran Masuk'];
        
        // Sample data for guidance (last column is Tahun Ajaran - can be '2024' or '2024/2025')
        const sampleData = [
            ['1234567890', 'Budi Santoso', '2010-05-15', 'L', '2024'],
            ['1234567891', 'Siti Nurhaliza', '2010-08-20', 'P', '2024'],
            ['1234567892', 'Ahmad Rizki', '2010-03-12', 'L', '2024']
        ];
        
        // Instructions
        const instructions = [
            ['TEMPLATE IMPORT DATA SISWA'],
            [''],
            ['PETUNJUK PENGISIAN:'],
            ['1. NIS: Nomor Induk Siswa (bisa angka atau kombinasi, bebas format)'],
            ['2. Nama Siswa: Nama lengkap siswa'],
            ['3. Tanggal Lahir: Format YYYY-MM-DD (contoh: 2010-05-15) atau kosongkan'],
            ['4. Jenis Kelamin: L (Laki-laki) atau P (Perempuan)'],
            ['5. Tahun Ajaran / Angkatan: Tahun tunggal (contoh: 2024) — opsional. Jika kosong, sistem akan mengisi dengan tahun TA aktif.'],
            [''],
            ['CONTOH DATA:'],
            headers,
            ...sampleData,
            [''],
            ['Hapus baris contoh ini dan isi dengan data siswa Anda mulai dari baris ke-11'],
            ['Pastikan kolom NIS dan Nama Siswa tidak kosong. Tahun Ajaran dapat berupa tahun tunggal (4 digit) atau rentang (YYYY/YYYY) jika diisi.']
        ];
        
        // Create worksheet
        const ws = xlsx.utils.aoa_to_sheet(instructions);
        
        // Set column widths
        ws['!cols'] = [
            { wch: 15 }, // NIS
            { wch: 30 }, // Nama Siswa
            { wch: 15 }, // Tanggal Lahir
            { wch: 15 }, // Jenis Kelamin
            { wch: 12 }  // Tahun Masuk
        ];
        
        // Add worksheet to workbook
        xlsx.utils.book_append_sheet(wb, ws, 'Template Siswa');
        
        // Generate buffer
        const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
        
        // Set response headers
        res.setHeader('Content-Disposition', 'attachment; filename=Template_Import_Siswa.xlsx');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        
        res.send(buffer);
        
    } catch (err) {
        console.error('Error generating student template:', err);
        res.status(500).json({ 
            message: 'Gagal membuat template', 
            error: err.message 
        });
    }
};

/**
 * Import students from Excel
 * POST /api/excel/students/import
 */
exports.importStudents = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Mohon upload file Excel' });
        }

        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        
        // Convert to JSON
        const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        
        // Find header row (should contain 'NISN', 'Nama Siswa', etc.)
        let headerRowIndex = -1;
        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            if (Array.isArray(row) && row.length >= 2) {
                const hasNisn = row.some(cell => cell && cell.toString().toUpperCase().includes('NIS'));
                const hasNama = row.some(cell => cell && cell.toString().toUpperCase().includes('NAMA'));
                // Must have both NISN and Nama columns (to avoid matching instruction rows)
                if (hasNisn && hasNama) {
                    headerRowIndex = i;
                    break;
                }
            }
        }
        
        if (headerRowIndex === -1) {
            return res.status(400).json({ 
                message: 'Format Excel tidak valid. Header "NIS" tidak ditemukan.',
                hint: 'Pastikan ada baris dengan kolom "NIS" di Excel Anda'
            });
        }
        
        const headers = data[headerRowIndex].map(h => h ? h.toString().trim().toUpperCase() : '');
        
        const nisnIndex = headers.findIndex(h => h.includes('NIS'));
        const namaIndex = headers.findIndex(h => h.includes('NAMA'));
        const tglLahirIndex = headers.findIndex(h => h.includes('TANGGAL') || h.includes('LAHIR'));
        const jenisKelaminIndex = headers.findIndex(h => h.includes('JENIS') || h.includes('KELAMIN'));
        
        if (nisnIndex === -1 || namaIndex === -1) {
            return res.status(400).json({ 
                message: 'Kolom NIS dan Nama Siswa harus ada di Excel',
                foundHeaders: headers,
                detectedIndices: { nisnIndex, namaIndex }
            });
        }
        
        const db = getDb();
        
        // Get active TA semester
        let activeTASemesterTahun = '';
        const activeTASemester = await new Promise((resolve) => {
            db.get('SELECT tahun_ajaran FROM tahunajaransemester WHERE is_aktif = ?', [true], (err, row) => {
                if (!err && row) {
                    activeTASemesterTahun = row.tahun_ajaran;
                }
                resolve(row);
            });
        });
        
        // Fallback to current year if no active semester found
        if (!activeTASemesterTahun) {
            activeTASemesterTahun = `${new Date().getFullYear() - 1}/${new Date().getFullYear()}`;
        }
        
        const results = {
            success: 0,
            skipped: 0,
            failed: 0,
            errors: []
        };
        
        // Process data rows (skip header and instructions)
        const dataRows = data.slice(headerRowIndex + 1);
        
        for (const row of dataRows) {
            // Skip empty rows or example rows
            if (!row[nisnIndex] || !row[namaIndex]) continue;
            
            const nisn = row[nisnIndex].toString().trim();
            const nama = row[namaIndex].toString().trim();
            const tglLahir = tglLahirIndex !== -1 && row[tglLahirIndex] ? row[tglLahirIndex].toString().trim() : null;
            const jenisKelamin = jenisKelaminIndex !== -1 && row[jenisKelaminIndex] ? row[jenisKelaminIndex].toString().trim().toUpperCase() : 'L';
            
            // Validate NISN (allow any format, just not empty)
            if (!nisn || nisn.length === 0) {
                results.failed++;
                results.errors.push(`NIS kosong untuk siswa: ${nama}`);
                continue;
            }
            
            // Validate jenis kelamin
            const validJK = jenisKelamin === 'L' || jenisKelamin === 'P' ? jenisKelamin : 'L';
            // Determine tahun_ajaran_masuk: prefer explicit column (if present), otherwise use active TA year
            // Look for header column names like 'TAHUN AJARAN MASUK', 'TAHUN AJARAN', 'ANGKATAN', or 'TAHUN'
            let tahunAjaranMasuk = null;
            const tahunHeaderCandidates = ['TAHUN AJARAN MASUK', 'TAHUN AJARAN', 'ANGKATAN', 'TAHUN'];
            for (let i = 0; i < headers.length; i++) {
                const h = headers[i];
                if (h && tahunHeaderCandidates.includes(h)) {
                    if (row[i]) {
                        const m = row[i].toString().match(/(\d{4})/);
                        if (m) tahunAjaranMasuk = m[1];
                    }
                    break;
                }
            }

            if (!tahunAjaranMasuk) {
                // Fallback: derive first year from active TA semester (e.g., '2024/2025' -> '2024')
                const m = (activeTASemesterTahun || '').toString().match(/(\d{4})/);
                tahunAjaranMasuk = m ? m[1] : activeTASemesterTahun;
            }

            try {
                await new Promise((resolve, reject) => {
                    // Check if student already exists
                    db.get('SELECT id_siswa FROM Siswa WHERE id_siswa = ?', [nisn], (err, existing) => {
                        if (err) return reject(err);
                        
                        if (existing) {
                            // Skip if already exists
                            results.skipped++;
                            resolve();
                        } else {
                            // Insert new student
                            db.run(
                                `INSERT INTO Siswa (id_siswa, nama_siswa, tanggal_lahir, jenis_kelamin, tahun_ajaran_masuk)
                                 VALUES (?, ?, ?, ?, ?)`,
                                [nisn, nama, tglLahir, validJK, tahunAjaranMasuk],
                                function(err) {
                                    if (err) {
                                        results.failed++;
                                        results.errors.push(`Gagal menambahkan ${nama} (${nisn}): ${err.message}`);
                                        reject(err);
                                    } else {
                                        results.success++;
                                        resolve();
                                    }
                                }
                            );
                        }
                    });
                });
            } catch (err) {
                // Error already logged
            }
        }
        
        res.json({
            success: true,
            message: `Import selesai. ${results.success} siswa ditambahkan, ${results.skipped} sudah ada, ${results.failed} gagal.`,
            details: results
        });
        
    } catch (err) {
        console.error('Error importing students:', err);
        res.status(500).json({ 
            message: 'Gagal memproses file Excel', 
            error: err.message 
        });
    }
};

// Export Template Excel untuk Enroll Siswa ke Kelas
exports.exportEnrollmentTemplate = async (req, res) => {
    try {
        const workbook = xlsx.utils.book_new();
        
        // Template data dengan instruksi
        const templateData = [
            ['TEMPLATE IMPORT ENROLLMENT SISWA KE KELAS'],
            [],
            ['PETUNJUK PENGISIAN:'],
            ['1. NIS: Nomor Induk Siswa (harus sudah terdaftar di sistem)'],
            ['2. Nama Kelas: Nama kelas tujuan (contoh: 10 IPA 1, 11 IPS 2)'],
            [''],
            ['CATATAN: Data akan otomatis masuk ke Tahun Ajaran Semester yang sedang aktif'],
            ['Pastikan NIS dan Nama Kelas sudah ada di sistem'],
            [],
            ['CONTOH DATA (mulai dari baris ke-11):'],
            ['NIS', 'Nama Kelas'],
            ['123456789', '1 Darahadeh'],
            ['987654321', '2 Daria'],
        ];
        
        const worksheet = xlsx.utils.aoa_to_sheet(templateData);
        
        // Set column widths
        worksheet['!cols'] = [
            { wch: 20 },
            { wch: 20 }
        ];
        
        xlsx.utils.book_append_sheet(workbook, worksheet, 'Template Enrollment');
        
        const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Template_Import_Enrollment.xlsx');
        res.send(buffer);
        
    } catch (err) {
        console.error('Error generating enrollment template:', err);
        res.status(500).json({ 
            message: 'Gagal membuat template Excel', 
            error: err.message 
        });
    }
};

// Import Enrollment Siswa ke Kelas dari Excel
exports.importEnrollment = async (req, res) => {
    try {
        console.log('[IMPORT-ENROLL] Import request by user:', req.user ? `${req.user.user_type}/${req.user.id}` : 'anonymous');
        console.log('[IMPORT-ENROLL] Uploaded file:', req.file ? req.file.originalname : '(no file)');

        if (!req.file) {
            return res.status(400).json({ message: 'Mohon upload file Excel' });
        }

        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        
        // Get active TA Semester
        const db = getDb();
        const activeTASemester = await new Promise((resolve, reject) => {
            db.get('SELECT id_ta_semester FROM tahunajaransemester WHERE is_aktif = ?', [true], (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });

        if (!activeTASemester) {
            return res.status(400).json({ 
                message: 'Tidak ada Tahun Ajaran Semester yang aktif. Silakan aktifkan terlebih dahulu.'
            });
        }

        const idTASemester = activeTASemester.id_ta_semester;
        console.log('[IMPORT-ENROLL] Active TA Semester id:', idTASemester);
        
        // Find header row (should contain 'NISN' and 'Nama Kelas')
        let headerRowIndex = -1;
        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            if (Array.isArray(row) && row.length >= 2) {
                const hasNISN = row.some(cell => cell && cell.toString().toUpperCase().includes('NIS'));
                const hasKelas = row.some(cell => cell && cell.toString().toUpperCase().includes('KELAS'));
                if (hasNISN && hasKelas) {
                    headerRowIndex = i;
                    break;
                }
            }
        }
        
        if (headerRowIndex === -1) {
            return res.status(400).json({ 
                message: 'Format Excel tidak valid. Header "NIS" dan "Nama Kelas" tidak ditemukan.',
                hint: 'Pastikan ada baris dengan kolom "NIS" dan "Nama Kelas" di Excel Anda'
            });
        }
        
        const headers = data[headerRowIndex].map(h => h ? h.toString().trim().toUpperCase() : '');
        
        const nisnIndex = headers.findIndex(h => h.includes('NIS'));
        const kelasIndex = headers.findIndex(h => h.includes('KELAS'));
        
        if (nisnIndex === -1 || kelasIndex === -1) {
            return res.status(400).json({ 
                message: 'Kolom NIS dan Nama Kelas harus ada di Excel',
                foundHeaders: headers,
                detectedIndices: { nisnIndex, kelasIndex }
            });
        }
        
        const results = {
            success: 0,
            skipped: 0,
            failed: 0,
            errors: []
        };
        
        // Process data rows (skip header and instructions)
        const dataRows = data.slice(headerRowIndex + 1);
        console.log(`[IMPORT-ENROLL] Found ${dataRows.length} rows to process (header index ${headerRowIndex})`);
        
        for (const row of dataRows) {
            // Skip empty rows
            if (!row[nisnIndex] || !row[kelasIndex]) continue;
            
            const nisn = row[nisnIndex].toString().trim();
            const namaKelas = row[kelasIndex].toString().trim();
            
            // Validate
            if (!nisn || nisn.length === 0) {
                results.failed++;
                results.errors.push(`NIS kosong`);
                continue;
            }
            
            if (!namaKelas || namaKelas.length === 0) {
                results.failed++;
                results.errors.push(`Nama kelas kosong untuk NIS: ${nisn}`);
                continue;
            }
            
            console.log(`[IMPORT-ENROLL] Processing row: NIS='${nisn}', Kelas='${namaKelas}'`);
            try {
                await new Promise((resolve, reject) => {
                    // Check if student exists
                    const nisnClean = nisn.trim();
                    // Try numeric lookup first (id_siswa int), fall back to string compare
                    const tryNumeric = /^[0-9]+$/.test(nisnClean);
                    const checkStudent = (cb) => {
                        if (tryNumeric) {
                            db.get('SELECT id_siswa FROM Siswa WHERE id_siswa = ?', [parseInt(nisnClean)], cb);
                        } else {
                            // Fallback to text compare
                            db.get('SELECT id_siswa FROM Siswa WHERE LOWER(CAST(id_siswa AS TEXT)) = LOWER(?)', [nisnClean], cb);
                        }
                    };

                    checkStudent((err, siswa) => {
                        if (err) return reject(err);
                        
                            if (!siswa) {
                            results.failed++;
                            results.errors.push(`Siswa dengan NIS ${nisn} tidak ditemukan`);
                            console.warn(`[IMPORT-ENROLL] Student not found: ${nisn}`);
                            return resolve();
                        }
                        
                        // Find class by name in active TA Semester
                        // Normalize class name to be more tolerant (case + whitespace)
                        const namaKelasClean = namaKelas.trim();
                        db.get(
                            'SELECT id_kelas FROM Kelas WHERE LOWER(TRIM(nama_kelas)) = LOWER(TRIM(?)) AND id_ta_semester = ?',
                            [namaKelasClean, idTASemester],
                            (err, kelas) => {
                                if (err) return reject(err);
                                
                                if (!kelas) {
                                    results.failed++;
                                    results.errors.push(`Kelas "${namaKelas}" tidak ditemukan di semester aktif untuk NIS: ${nisn}`);
                                    console.warn(`[IMPORT-ENROLL] Class not found: ${namaKelas} (semester ${idTASemester})`);
                                    return resolve();
                                }
                                
                                // Check if already enrolled
                                        db.get(
                                    'SELECT * FROM SiswaKelas WHERE id_siswa = ? AND id_kelas = ? AND id_ta_semester = ?',
                                    [siswa.id_siswa, kelas.id_kelas, idTASemester],
                                    (err, existing) => {
                                        if (err) return reject(err);
                                        
                                        if (existing) {
                                            results.skipped++;
                                            console.log(`[IMPORT-ENROLL] Already enrolled: NIS=${siswa.id_siswa}, id_kelas=${kelas.id_kelas}`);
                                            return resolve();
                                        }
                                        
                                        // Enroll student
                                        db.run(
                                            `INSERT INTO SiswaKelas (id_siswa, id_kelas, id_ta_semester)
                                             VALUES (?, ?, ?)`,
                                            [siswa.id_siswa, kelas.id_kelas, idTASemester],
                                            function(err) {
                                                if (err) {
                                                    results.failed++;
                                                    results.errors.push(`Gagal enroll NIS ${nisn} ke ${namaKelas}: ${err.message}`);
                                                    console.error(`[IMPORT-ENROLL] Failed to insert enrollment: NIS=${siswa.id_siswa}, id_kelas=${kelas.id_kelas}`, err.message);
                                                    return reject(err);
                                                }
                                                results.success++;
                                                resolve();
                                            }
                                        );
                                    }
                                );
                            }
                        );
                    });
                });
            } catch (err) {
                // Error already handled in promise
                continue;
            }
        }
        
        console.log('[IMPORT-ENROLL] Summary:', results);
        res.json({
            success: true,
            message: `Import selesai: ${results.success} berhasil, ${results.skipped} sudah terdaftar, ${results.failed} gagal`,
            details: results
        });
        
    } catch (err) {
        console.error('Error importing enrollment:', err);
        res.status(500).json({ 
            message: 'Gagal memproses file Excel', 
            error: err.message 
        });
    }
};