const ExcelJS = require('exceljs');
const { getDb } = require('../config/db');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');
const excelController = require('./excelController');

/**
 * Export template Excel untuk input nilai
 * GET /api/grades/export-template/:id_guru/:id_mapel/:id_kelas/:id_ta_semester
 */
exports.exportGradeTemplate = async (req, res) => {
    try {
        const { id_guru, id_mapel, id_kelas, id_ta_semester } = req.params;
        
        const db = getDb();
        
        // 1. Get class and subject info
        const classInfo = await new Promise((resolve, reject) => {
            db.get(
                `SELECT k.nama_kelas, m.nama_mapel, tas.tahun_ajaran, tas.semester
                 FROM kelas k, matapelajaran m, tahunajaransemester tas
                 WHERE k.id_kelas = ? AND m.id_mapel = ? AND tas.id_ta_semester = ?`,
                [id_kelas, id_mapel, id_ta_semester],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
        
        if (!classInfo) {
            return res.status(404).json({ message: 'Kelas atau mapel tidak ditemukan' });
        }
        
        // 2. Get students list
        const students = await new Promise((resolve, reject) => {
            db.all(
                `SELECT s.id_siswa, s.nama_siswa
                 FROM siswa s
                 INNER JOIN SiswaKelas sk ON s.id_siswa = sk.id_siswa
                 WHERE sk.id_kelas = ? AND sk.id_ta_semester = ?
                 ORDER BY s.nama_siswa`,
                [id_kelas, id_ta_semester],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
        
        if (!students || students.length === 0) {
            return res.status(404).json({ message: 'Tidak ada siswa di kelas ini' });
        }
        
        // 3. Get TP columns from ATP
        const tingkatKelas = parseInt(classInfo.nama_kelas.match(/^(\d+)/)?.[1] || '1');
        let fase = 'A';
        if (tingkatKelas >= 1 && tingkatKelas <= 2) fase = 'A';
        else if (tingkatKelas >= 3 && tingkatKelas <= 4) fase = 'B';
        else if (tingkatKelas >= 5 && tingkatKelas <= 6) fase = 'C';
        
        const semesterNumber = classInfo.semester.toLowerCase() === 'ganjil' ? 1 : 2;
        
        // Get CP to find file_path
        const cpRow = await new Promise((resolve, reject) => {
            db.get(
                `SELECT cp.file_path, m.nama_mapel 
                 FROM capaianpembelajaran cp
                 JOIN matapelajaran m ON cp.id_mapel = m.id_mapel
                 WHERE cp.id_mapel = ? AND cp.fase = ?`,
                [id_mapel, fase],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
        
        let tpColumns = []; // Array of TP descriptions
        
        if (cpRow && cpRow.file_path) {
            try {
                const filePath = path.join(__dirname, '../../', cpRow.file_path);
                
                if (fs.existsSync(filePath)) {
                    const workbook = xlsx.readFile(filePath);
                    const targetSheetName = `ATP ${cpRow.nama_mapel} Fase ${fase}`;
                    const sheetName = workbook.SheetNames.find(name => 
                        name.toLowerCase() === targetSheetName.toLowerCase()
                    );
                    
                    if (sheetName) {
                        const sheet = workbook.Sheets[sheetName];
                        const data = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
                        
                        const headers = data[4] || [];
                        const rows = data.slice(5);
                        
                        const tpIndex = headers.findIndex(h => 
                            h && h.toString().toLowerCase().includes('tujuan pembelajaran')
                        );
                        const kelasIndex = headers.findIndex(h => 
                            h && h.toString().toLowerCase() === 'kelas'
                        );
                        const semesterIndex = headers.findIndex(h => 
                            h && h.toString().toLowerCase() === 'semester'
                        );
                        
                        // Helper function to parse kelas range
                        const parseKelasRange = (kelasStr) => {
                            if (!kelasStr) return [];
                            const str = kelasStr.toString().trim();
                            
                            if (str.includes('dan')) {
                                return str.split('dan').map(k => parseInt(k.trim())).filter(k => !isNaN(k));
                            }
                            
                            if (str.includes('-')) {
                                const parts = str.split('-').map(k => parseInt(k.trim()));
                                if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                                    const result = [];
                                    for (let i = parts[0]; i <= parts[1]; i++) {
                                        result.push(i);
                                    }
                                    return result;
                                }
                            }
                            
                            const num = parseInt(str);
                            return isNaN(num) ? [] : [num];
                        };
                        
                        // Helper function to parse semester range
                        const parseSemesterRange = (semesterStr) => {
                            if (!semesterStr) return [];
                            const str = semesterStr.toString().trim();
                            
                            if (str.includes('dan')) {
                                return str.split('dan').map(s => parseInt(s.trim())).filter(s => !isNaN(s));
                            }
                            
                            if (str.toLowerCase().includes('lv') || str.toLowerCase().includes('sem')) {
                                return [1, 2];
                            }
                            
                            const num = parseInt(str);
                            return isNaN(num) ? [] : [num];
                        };
                        
                        // Filter by kelas and semester
                        rows.forEach(row => {
                            const kelasValue = row[kelasIndex];
                            const semesterValue = row[semesterIndex];
                            const tpDesc = row[tpIndex];
                            
                            if (!tpDesc || tpDesc.toString().trim() === '') {
                                return;
                            }
                            
                            // Check kelas match
                            const kelasRange = parseKelasRange(kelasValue);
                            if (!kelasRange.includes(tingkatKelas)) {
                                return;
                            }
                            
                            // Check semester match
                            const semesterRange = parseSemesterRange(semesterValue);
                            if (semesterRange.length > 0 && !semesterRange.includes(semesterNumber)) {
                                return;
                            }
                            
                            tpColumns.push(tpDesc.toString());
                        });
                    }
                }
            } catch (err) {
                console.log('Error loading TP from ATP:', err.message);
            }
        }
        
        // 🆕 Get manual TP from database and merge with ATP TP
        try {
            console.log('🔍 Export Template - Checking manual TP for:', { id_guru, id_mapel, id_kelas, id_ta_semester });
            
            // Check if guru-mapel-kelas assignment exists
            const assignmentExists = await new Promise((resolve, reject) => {
                db.get(
                    `SELECT id_guru, id_mapel, id_kelas, id_ta_semester FROM gurumatapelajarankelas 
                     WHERE id_guru = ? AND id_mapel = ? AND id_kelas = ? AND id_ta_semester = ?`,
                    [id_guru, id_mapel, id_kelas, id_ta_semester],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    }
                );
            });
            
            console.log('📋 Assignment exists:', assignmentExists);
            
            if (assignmentExists) {
                // Generate composite id_penugasan (same format as guruController)
                const id_penugasan = `${id_guru}-${id_mapel}-${id_kelas}-${id_ta_semester}`;
                console.log('🔑 Generated id_penugasan:', id_penugasan);
                
                // Get manual TP
                const manualTps = await new Promise((resolve, reject) => {
                    db.all(
                        `SELECT tp_number, tp_name FROM manual_tp 
                         WHERE id_penugasan = ? AND id_ta_semester = ?
                         ORDER BY tp_number`,
                        [id_penugasan, id_ta_semester],
                        (err, rows) => {
                            if (err) reject(err);
                            else resolve(rows);
                        }
                    );
                });
                
                console.log('📝 Manual TPs found:', manualTps ? manualTps.length : 0, manualTps);
                
                // Merge manual TP with ATP TP
                if (manualTps && manualTps.length > 0) {
                    console.log('🔄 Before merge - ATP TPs:', tpColumns.length, tpColumns);
                    
                    // Get all TP numbers from both sources
                    const allTpNumbers = new Set();
                    for (let i = 0; i < tpColumns.length; i++) {
                        allTpNumbers.add(i + 1);
                    }
                    manualTps.forEach(tp => allTpNumbers.add(tp.tp_number));
                    
                    // Build final tpColumns array
                    const maxTpNumber = Math.max(...allTpNumbers);
                    const mergedTpColumns = [];
                    
                    for (let i = 1; i <= maxTpNumber; i++) {
                        const manualTp = manualTps.find(tp => tp.tp_number === i);
                        if (manualTp) {
                            // Use manual TP description (prioritas)
                            mergedTpColumns.push(manualTp.tp_name);
                        } else if (i <= tpColumns.length) {
                            // Use ATP description
                            mergedTpColumns.push(tpColumns[i - 1]);
                        } else {
                            // Default if missing
                            mergedTpColumns.push(`TP ${i}`);
                        }
                    }
                    
                    tpColumns = mergedTpColumns;
                    console.log(`✅ After merge - Total TPs: ${tpColumns.length}`, tpColumns);
                    console.log(`✅ Merged ${manualTps.length} manual TP with ${tpColumns.length - manualTps.length} ATP TP`);
                } else {
                    console.log('ℹ️ No manual TPs found to merge');
                }
            } else {
                console.log('⚠️ Penugasan not found, cannot fetch manual TP');
            }
        } catch (err) {
            console.log('⚠️ Error loading manual TP:', err.message, err.stack);
        }
        
        // If no TP from ATP or manual, use default
        if (tpColumns.length === 0) {
            tpColumns = ['TP 1', 'TP 2', 'TP 3']; // Default 3 TP
        }
        
        // 4. Create Excel workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Template Nilai');
        
        // Add info rows
        worksheet.mergeCells('A1:' + String.fromCharCode(65 + tpColumns.length + 2) + '1');
        worksheet.getCell('A1').value = 'TEMPLATE INPUT NILAI';
        worksheet.getCell('A1').font = { bold: true, size: 14 };
        worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
        
        worksheet.getCell('A2').value = `Mata Pelajaran: ${classInfo.nama_mapel}`;
        worksheet.getCell('A2').font = { bold: false, size: 11 };
        
        worksheet.getCell('A3').value = `Kelas: ${classInfo.nama_kelas}`;
        worksheet.getCell('A3').font = { bold: false, size: 11 };
        
        worksheet.getCell('A4').value = `Tahun Ajaran: ${classInfo.tahun_ajaran} - Semester ${classInfo.semester}`;
        worksheet.getCell('A4').font = { bold: false, size: 11 };
        
        // Empty row
        worksheet.getCell('A5').value = '';
        
        // Header row (row 6)
        const headerRow = worksheet.getRow(6);
        const headerValues = ['ID Siswa', 'Nama Siswa'];
        tpColumns.forEach((_, index) => {
            headerValues.push(`TP ${index + 1}`);
        });
        headerValues.push('UAS');
        headerValues.push('Nilai Akhir');
        
        headerRow.values = headerValues;
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4472C4' }
        };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
        headerRow.height = 20;
        
        // Set column widths
        worksheet.getColumn(1).width = 12; // ID Siswa
        worksheet.getColumn(2).width = 30; // Nama Siswa
        for (let i = 0; i < tpColumns.length; i++) {
            worksheet.getColumn(3 + i).width = 10; // TP columns
        }
        worksheet.getColumn(3 + tpColumns.length).width = 10; // UAS
        worksheet.getColumn(4 + tpColumns.length).width = 12; // Nilai Akhir
        
        // Add students data (starting from row 7)
        students.forEach((student, index) => {
            const rowNum = 7 + index;
            const row = worksheet.getRow(rowNum);
            
            const rowValues = [student.id_siswa, student.nama_siswa];
            tpColumns.forEach(() => {
                rowValues.push(''); // Empty cells for TP
            });
            rowValues.push(''); // Empty UAS
            
            // Formula for Nilai Akhir
            const tpStartCol = 3;
            const tpEndCol = 3 + tpColumns.length - 1;
            const uasCol = 3 + tpColumns.length;
            const finalCol = 4 + tpColumns.length;
            
            const tpStartLetter = String.fromCharCode(64 + tpStartCol);
            const tpEndLetter = String.fromCharCode(64 + tpEndCol);
            const uasLetter = String.fromCharCode(64 + uasCol);
            
            const avgTpFormula = `AVERAGE(${tpStartLetter}${rowNum}:${tpEndLetter}${rowNum})`;
            const finalFormula = `IF(OR(${uasLetter}${rowNum}="",COUNTBLANK(${tpStartLetter}${rowNum}:${tpEndLetter}${rowNum})=${tpColumns.length}),"",ROUND(${avgTpFormula}*0.7+${uasLetter}${rowNum}*0.3,2))`;
            
            rowValues.push({ formula: finalFormula });
            
            row.values = rowValues;
            
            // Add border to all cells
            row.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
            
            // Readonly for ID and Nama (light gray background)
            row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
            row.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
            
            // Format number for final grade
            row.getCell(finalCol).numFmt = '0.00';
        });
        
        // Add TP descriptions in a separate sheet
        const descSheet = workbook.addWorksheet('Deskripsi TP');
        descSheet.columns = [
            { header: 'TP', key: 'tp_num', width: 10 },
            { header: 'Deskripsi', key: 'description', width: 80 }
        ];
        
        const descHeaderRow = descSheet.getRow(1);
        descHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        descHeaderRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF70AD47' }
        };
        
        tpColumns.forEach((desc, index) => {
            descSheet.addRow({
                tp_num: `TP ${index + 1}`,
                description: desc
            });
        });
        
        // 5. Send file
        // Sanitize filename: remove special chars, replace spaces with underscore
        const sanitizeFilename = (str) => {
            return str
                .replace(/[^\w\s-]/g, '') // Remove special chars except word chars, spaces, hyphens
                .replace(/\s+/g, '_')      // Replace spaces with underscore
                .replace(/_+/g, '_')       // Replace multiple underscores with single
                .trim();
        };
        
        const mapelName = sanitizeFilename(classInfo.nama_mapel);
        const kelasName = sanitizeFilename(classInfo.nama_kelas);
        const semesterName = classInfo.semester === 'Ganjil' ? 'Ganjil' : 'Genap';
        const tahunAjaran = classInfo.tahun_ajaran.replace('/', '-'); // 2024/2025 -> 2024-2025
        
        // Format: Template_Nilai_[Mapel]_[Kelas]_[Semester]_[TahunAjaran].xlsx
        // Contoh: Template_Nilai_IPA_1_Gumujeng_Ganjil_2024-2025.xlsx
        const filename = `Template_Nilai_${mapelName}_${kelasName}_${semesterName}_${tahunAjaran}.xlsx`;
        
        console.log('=== EXPORT TEMPLATE DEBUG ===');
        console.log('Class Info:', classInfo);
        console.log('Mapel Name (sanitized):', mapelName);
        console.log('Kelas Name (sanitized):', kelasName);
        console.log('Semester:', semesterName);
        console.log('Tahun Ajaran:', tahunAjaran);
        console.log('Final Filename:', filename);
        console.log('===========================');
        
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="${filename}"`
        );
        
        await workbook.xlsx.write(res);
        res.end();
        
    } catch (err) {
        console.error('Error exporting template:', err);
        res.status(500).json({ 
            message: 'Gagal export template', 
            error: err.message 
        });
    }
};

/**
 * Import nilai dari Excel
 * POST /api/grades/import-from-excel
 */
exports.importGradesFromExcel = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'File Excel tidak ditemukan' });
        }
        
        const { id_guru, id_mapel, id_kelas, id_ta_semester } = req.body;
        
        if (!id_guru || !id_mapel || !id_kelas || !id_ta_semester) {
            return res.status(400).json({ message: 'Parameter tidak lengkap' });
        }
        
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);
        
        const worksheet = workbook.getWorksheet('Template Nilai');
        
        if (!worksheet) {
            return res.status(400).json({ message: 'Sheet "Template Nilai" tidak ditemukan' });
        }
        
        const db = getDb();
        let successCount = 0;
        let failCount = 0;
        const errors = [];
        
        // Find header row (row 6)
        const headerRow = worksheet.getRow(6);
        const headers = [];
        headerRow.eachCell((cell, colNumber) => {
            headers[colNumber] = cell.value;
        });
        
        // Find column indices
        const idSiswaCol = headers.findIndex(h => h === 'ID Siswa');
        const tpStartCol = headers.findIndex(h => h === 'TP 1');
        const uasCol = headers.findIndex(h => h === 'UAS');
        
        if (idSiswaCol === -1 || tpStartCol === -1 || uasCol === -1) {
            return res.status(400).json({ message: 'Format Excel tidak sesuai template' });
        }
        
        // Count TP columns
        let tpCount = 0;
        for (let i = tpStartCol; i < uasCol; i++) {
            if (headers[i] && headers[i].toString().startsWith('TP ')) {
                tpCount++;
            }
        }
        
        // Process each student row (starting from row 7)
        for (let rowNum = 7; rowNum <= worksheet.rowCount; rowNum++) {
            const row = worksheet.getRow(rowNum);
            const idSiswa = row.getCell(idSiswaCol).value;
            
            if (!idSiswa) continue; // Skip empty rows
            
            // Verify student exists and get student name for better error messages
            const student = await new Promise((resolve, reject) => {
                db.get(
                    'SELECT id_siswa, nama_siswa FROM siswa WHERE id_siswa = ?',
                    [idSiswa],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    }
                );
            });
            
            if (!student) {
                errors.push({
                    nisn: idSiswa,
                    error: `NISN ${idSiswa} tidak ditemukan di database siswa. Pastikan NISN sudah terdaftar.`
                });
                failCount++;
                continue;
            }
            
            // ✅ NEW: Verify student is enrolled in this class for this semester
            const enrollment = await new Promise((resolve, reject) => {
                db.get(
                    `SELECT id_siswa 
                     FROM SiswaKelas
                     WHERE id_siswa = ? AND id_kelas = ? AND id_ta_semester = ?`,
                    [student.id_siswa, id_kelas, id_ta_semester],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    }
                );
            });
            
            if (!enrollment) {
                errors.push({
                    siswa: student.nama_siswa,
                    nisn: idSiswa,
                    error: `Siswa ${student.nama_siswa} (NISN: ${idSiswa}) tidak terdaftar di kelas ini untuk semester aktif. Pastikan siswa sudah di-enroll ke kelas.`
                });
                failCount++;
                continue;
            }
            
            // Save TP grades
            for (let tpNum = 1; tpNum <= tpCount; tpNum++) {
                const colIndex = tpStartCol + (tpNum - 1);
                const gradeValue = row.getCell(colIndex).value;
                
                if (gradeValue !== null && gradeValue !== '' && gradeValue !== undefined) {
                    const nilai = parseFloat(gradeValue);
                    
                    if (isNaN(nilai) || nilai < 0 || nilai > 100) {
                        errors.push({
                            siswa: student.nama_siswa,
                            nisn: idSiswa,
                            jenis: `TP ${tpNum}`,
                            nilai: gradeValue,
                            error: `Nilai tidak valid (harus 0-100)`
                        });
                        failCount++;
                        continue;
                    }
                    
                    try {
                        // ✅ FIX: Cek dulu apakah TP sudah ada
                        const existingTp = await new Promise((resolve, reject) => {
                            db.get(
                                `SELECT id_nilai FROM nilai 
                                 WHERE id_siswa = ? AND id_guru = ? AND id_mapel = ? 
                                 AND id_kelas = ? AND id_ta_semester = ? AND jenis_nilai = 'TP' AND urutan_tp = ?`,
                                [student.id_siswa, id_guru, id_mapel, id_kelas, id_ta_semester, tpNum],
                                (err, row) => {
                                    if (err) reject(err);
                                    else resolve(row);
                                }
                            );
                        });
                        
                        if (existingTp) {
                            // Update existing
                            await new Promise((resolve, reject) => {
                                db.run(
                                    `UPDATE nilai SET nilai = ?, tanggal_input = CURRENT_TIMESTAMP, keterangan = ?
                                     WHERE id_nilai = ?`,
                                    [nilai, `TP ${tpNum}`, existingTp.id_nilai],
                                    function(err) {
                                        if (err) reject(err);
                                        else resolve();
                                    }
                                );
                            });
                        } else {
                            // Insert new
                            await new Promise((resolve, reject) => {
                                db.run(
                                    `INSERT INTO nilai (id_siswa, id_guru, id_mapel, id_kelas, id_ta_semester, jenis_nilai, urutan_tp, nilai, tanggal_input, keterangan)
                                     VALUES (?, ?, ?, ?, ?, 'TP', ?, ?, CURRENT_TIMESTAMP, ?)`,
                                    [student.id_siswa, id_guru, id_mapel, id_kelas, id_ta_semester, tpNum, nilai, `TP ${tpNum}`],
                                    function(err) {
                                        if (err) reject(err);
                                        else resolve();
                                    }
                                );
                            });
                        }
                        successCount++;
                    } catch (err) {
                        errors.push({
                            siswa: student.nama_siswa,
                            nisn: idSiswa,
                            jenis: `TP ${tpNum}`,
                            nilai: gradeValue,
                            error: err.message
                        });
                        failCount++;
                    }
                }
            }
            
            // Save UAS grade
            const uasValue = row.getCell(uasCol).value;
            
            if (uasValue !== null && uasValue !== '' && uasValue !== undefined) {
                const nilai = parseFloat(uasValue);
                
                if (isNaN(nilai) || nilai < 0 || nilai > 100) {
                    errors.push({
                        siswa: student.nama_siswa,
                        nisn: idSiswa,
                        jenis: 'UAS',
                        nilai: uasValue,
                        error: `Nilai tidak valid (harus 0-100)`
                    });
                    failCount++;
                    continue;
                }
                
                try {
                    // ✅ FIX: Untuk UAS, cek dulu apakah sudah ada
                    const existingUas = await new Promise((resolve, reject) => {
                        db.get(
                            `SELECT id_nilai FROM nilai 
                             WHERE id_siswa = ? AND id_guru = ? AND id_mapel = ? 
                             AND id_kelas = ? AND id_ta_semester = ? AND jenis_nilai = 'UAS'`,
                            [student.id_siswa, id_guru, id_mapel, id_kelas, id_ta_semester],
                            (err, row) => {
                                if (err) reject(err);
                                else resolve(row);
                            }
                        );
                    });
                    
                    if (existingUas) {
                        // Update existing
                        await new Promise((resolve, reject) => {
                            db.run(
                                `UPDATE nilai SET nilai = ?, tanggal_input = CURRENT_TIMESTAMP, keterangan = 'UAS'
                                 WHERE id_nilai = ?`,
                                [nilai, existingUas.id_nilai],
                                function(err) {
                                    if (err) reject(err);
                                    else resolve();
                                }
                            );
                        });
                    } else {
                        // Insert new
                        await new Promise((resolve, reject) => {
                            db.run(
                                `INSERT INTO nilai (id_siswa, id_guru, id_mapel, id_kelas, id_ta_semester, jenis_nilai, urutan_tp, nilai, tanggal_input, keterangan)
                                 VALUES (?, ?, ?, ?, ?, 'UAS', NULL, ?, CURRENT_TIMESTAMP, 'UAS')`,
                                [student.id_siswa, id_guru, id_mapel, id_kelas, id_ta_semester, nilai],
                                function(err) {
                                    if (err) reject(err);
                                    else resolve();
                                }
                            );
                        });
                    }
                    successCount++;
                } catch (err) {
                    errors.push({
                        siswa: student.nama_siswa,
                        nisn: idSiswa,
                        jenis: 'UAS',
                        nilai: uasValue,
                        error: err.message
                    });
                    failCount++;
                }
            }
        }
        
        res.status(200).json({
            message: `Import selesai. Berhasil: ${successCount}, Gagal: ${failCount}`,
            success: successCount,
            failed: failCount,
            errors: errors
        });
        
    } catch (err) {
        console.error('Error importing grades:', err);
        res.status(500).json({ 
            message: 'Gagal import nilai dari Excel', 
            error: err.message 
        });
    }
};

/**
 * Helper function: Get TP list directly from Excel without HTTP call
 */
async function getTpListDirect(db, id_mapel, fase, id_kelas, semesterText, id_ta_semester = null) {
    try {
        // Get kelas info
        const kelasRow = await new Promise((resolve, reject) => {
            db.get(
                'SELECT k.nama_kelas FROM kelas k WHERE k.id_kelas = ?',
                [id_kelas],
                (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                }
            );
        });

        if (!kelasRow) {
            throw new Error('Kelas tidak ditemukan');
        }

        // Determine semester filterr
        const semesterFilter = semesterText.toLowerCase() === 'ganjil' ? 1 : 2;

        // Extract tingkat kelas
        const match = kelasRow.nama_kelas.match(/^(\d+)/);
        if (!match) {
            throw new Error('Format nama kelas tidak valid');
        }
        
        const tingkatKelas = parseInt(match[1]);
        
        // Get file path
        const cpRow = await new Promise((resolve, reject) => {
            db.get(
                `SELECT cp.file_path, m.nama_mapel 
                 FROM capaianpembelajaran cp
                 JOIN matapelajaran m ON cp.id_mapel = m.id_mapel
                 WHERE cp.id_mapel = ? AND cp.fase = ?`,
                [id_mapel, fase],
                (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                }
            );
        });

        if (!cpRow || !cpRow.file_path) {
            return [];
        }

        // Read Excel file
        const filePath = path.join(__dirname, '../../', cpRow.file_path);
        
        if (!fs.existsSync(filePath)) {
            return [];
        }

        const workbook = xlsx.readFile(filePath);
        
        // Find sheet
        const targetSheetName = `ATP ${cpRow.nama_mapel} Fase ${fase}`;
        const sheetName = workbook.SheetNames.find(name => 
            name.toLowerCase() === targetSheetName.toLowerCase()
        );
        
        if (!sheetName) {
            return [];
        }

        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        
        const headers = data[4] || [];
        const rows = data.slice(5);
        
        // Find column indexes
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
            return [];
        }

        // Helper function to parse kelas range (e.g., "1 dan 2", "1 - 3", "1")
        const parseKelasRange = (kelasStr) => {
            if (!kelasStr) return [];
            const str = kelasStr.toString().trim();
            
            // Pattern: "1 dan 2" atau "1 dan 2 dan 3"
            if (str.includes('dan')) {
                return str.split('dan').map(k => parseInt(k.trim())).filter(k => !isNaN(k));
            }
            
            // Pattern: "1 - 3" atau "1-3"
            if (str.includes('-')) {
                const parts = str.split('-').map(k => parseInt(k.trim()));
                if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                    const result = [];
                    for (let i = parts[0]; i <= parts[1]; i++) {
                        result.push(i);
                    }
                    return result;
                }
            }
            
            // Single number
            const num = parseInt(str);
            return isNaN(num) ? [] : [num];
        };
        
        // Helper function to parse semester range
        const parseSemesterRange = (semesterStr) => {
            if (!semesterStr) return [];
            const str = semesterStr.toString().trim();
            
            // Pattern: "1 dan 2"
            if (str.includes('dan')) {
                return str.split('dan').map(s => parseInt(s.trim())).filter(s => !isNaN(s));
            }
            
            // Pattern: "Lv 1 Sem 21" or special cases - accept all
            if (str.toLowerCase().includes('lv') || str.toLowerCase().includes('sem')) {
                return [1, 2]; // Accept both semesters
            }
            
            // Single number
            const num = parseInt(str);
            return isNaN(num) ? [] : [num];
        };

        // Filter TP from ATP
        const tpList = rows
            .filter(row => {
                const kelasExcel = row[kelasIndex];
                const tpText = row[tpIndex];
                const semesterExcel = row[semesterIndex];
                
                // Check if TP text exists
                if (!tpText || tpText.toString().trim() === '') {
                    return false;
                }
                
                // Check kelas match (support ranges like "1 dan 2" or "1 - 3")
                const kelasRange = parseKelasRange(kelasExcel);
                const kelasMatch = kelasRange.includes(tingkatKelas);
                
                if (!kelasMatch) {
                    return false;
                }
                
                // Check semester match if semester column exists
                if (semesterFilter && semesterIndex !== -1 && semesterExcel) {
                    const semesterRange = parseSemesterRange(semesterExcel);
                    const semesterMatch = semesterRange.includes(semesterFilter);
                    return semesterMatch;
                }
                
                return true;
            })
            .map((row, index) => ({
                urutan_tp: index + 1,
                tujuan_pembelajaran: row[tpIndex],
                semester: row[semesterIndex] || null,
                kktp: row[kktpIndex] || null,
                kelas_excel: row[kelasIndex]
            }));

        // 🆕 Get manual TP from database and merge
        try {
            console.log('🔍 getTpListDirect - Checking manual TP for:', { id_mapel, id_kelas, semesterText, id_ta_semester });
            
            // Use provided id_ta_semester if available, otherwise query by semester text
            let targetTaSemester = id_ta_semester;
            
            if (!targetTaSemester) {
                const taSemesterRow = await new Promise((resolve, reject) => {
                    db.get(
                        `SELECT id_ta_semester FROM tahunajaransemester WHERE semester = ?`,
                        [semesterText],
                        (err, row) => {
                            if (err) reject(err);
                            else resolve(row);
                        }
                    );
                });
                
                console.log('📅 getTpListDirect - TA Semester from text query:', taSemesterRow);
                targetTaSemester = taSemesterRow ? taSemesterRow.id_ta_semester : null;
            } else {
                console.log('📅 getTpListDirect - Using provided id_ta_semester:', targetTaSemester);
            }
            
            if (targetTaSemester) {
                // Check if guru-mapel-kelas assignment exists
                const assignmentRow = await new Promise((resolve, reject) => {
                    db.get(
                        `SELECT id_guru, id_mapel, id_kelas, id_ta_semester FROM gurumatapelajarankelas
                         WHERE id_mapel = ? AND id_kelas = ? AND id_ta_semester = ?
                         LIMIT 1`,
                        [id_mapel, id_kelas, targetTaSemester],
                        (err, row) => {
                            if (err) reject(err);
                            else resolve(row);
                        }
                    );
                });
                
                console.log('📋 getTpListDirect - Assignment found:', assignmentRow);
                
                if (assignmentRow) {
                    // Generate composite id_penugasan
                    const id_penugasan = `${assignmentRow.id_guru}-${assignmentRow.id_mapel}-${assignmentRow.id_kelas}-${assignmentRow.id_ta_semester}`;
                    console.log('🔑 getTpListDirect - Generated id_penugasan:', id_penugasan);
                    
                    // Get manual TP
                    const manualTps = await new Promise((resolve, reject) => {
                        db.all(
                            `SELECT tp_number, tp_name FROM manual_tp 
                             WHERE id_penugasan = ? AND id_ta_semester = ?
                             ORDER BY tp_number`,
                            [id_penugasan, targetTaSemester],
                            (err, rows) => {
                                if (err) reject(err);
                                else resolve(rows);
                            }
                        );
                    });
                    
                    console.log('📝 getTpListDirect - Manual TPs found:', manualTps ? manualTps.length : 0, manualTps);
                    
                    // Merge manual TP with ATP result
                    if (manualTps && manualTps.length > 0) {
                        console.log('🔄 getTpListDirect - Before merge - ATP TPs:', tpList.length);
                        
                        // Get all TP numbers
                        const allTpNumbers = new Set();
                        for (let i = 0; i < tpList.length; i++) {
                            allTpNumbers.add(i + 1);
                        }
                        manualTps.forEach(tp => allTpNumbers.add(tp.tp_number));
                        
                        // Build final merged result
                        const maxTpNumber = Math.max(...allTpNumbers);
                        const mergedResult = [];
                        
                        for (let i = 1; i <= maxTpNumber; i++) {
                            const manualTp = manualTps.find(tp => tp.tp_number === i);
                            if (manualTp) {
                                // Use manual TP (prioritas)
                                mergedResult.push({
                                    urutan_tp: i,
                                    tujuan_pembelajaran: manualTp.tp_name,
                                    semester: null,
                                    kktp: 75,
                                    kelas_excel: kelasRow.nama_kelas
                                });
                            } else if (i <= tpList.length) {
                                // Use ATP
                                mergedResult.push({
                                    ...tpList[i - 1],
                                    urutan_tp: i
                                });
                            } else {
                                // Default
                                mergedResult.push({
                                    urutan_tp: i,
                                    tujuan_pembelajaran: `TP ${i}`,
                                    semester: null,
                                    kktp: 75,
                                    kelas_excel: kelasRow.nama_kelas
                                });
                            }
                        }
                        
                        console.log(`✅ getTpListDirect: After merge - Total ${mergedResult.length} TPs (${manualTps.length} manual + ${tpList.length} ATP)`);
                        return mergedResult;
                    } else {
                        console.log('ℹ️ getTpListDirect - No manual TPs to merge');
                    }
                } else {
                    console.log('⚠️ getTpListDirect - Assignment not found');
                }
            } else {
                console.log('⚠️ getTpListDirect - TA Semester not found');
            }
        } catch (err) {
            console.log('⚠️ Error loading manual TP in getTpListDirect:', err.message, err.stack);
        }

        return tpList;
    } catch (err) {
        console.error('Error getting TP list:', err);
        return [];
    }
}

/**
 * Export nilai final ke Excel (dengan data nilai yang sudah diinput)
 * GET /api/grades/export/:id_guru/:id_mapel/:id_kelas/:id_ta_semester
 */
exports.exportFinalGrades = async (req, res) => {
    try {
        const { id_guru, id_mapel, id_kelas, id_ta_semester } = req.params;
        
        console.log('=== Export Final Grades Request ===');
        console.log('Params:', { id_guru, id_mapel, id_kelas, id_ta_semester });
        
        const db = getDb();
        
        // 1. Get class and subject info
        const classInfo = await new Promise((resolve, reject) => {
            db.get(
                `SELECT k.nama_kelas, m.nama_mapel, tas.tahun_ajaran, tas.semester
                 FROM Kelas k, MataPelajaran m, TahunAjaranSemester tas
                 WHERE k.id_kelas = ? AND m.id_mapel = ? AND tas.id_ta_semester = ?`,
                [id_kelas, id_mapel, id_ta_semester],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
        
        console.log('Class Info:', classInfo);
        
        if (!classInfo) {
            return res.status(404).json({ message: 'Kelas atau mapel tidak ditemukan' });
        }
        
        // Auto-detect fase from kelas tingkat (more reliable than database)
        const tingkatMatch = classInfo.nama_kelas.match(/^(\d+)/);
        if (!tingkatMatch) {
            return res.status(400).json({ message: 'Format nama kelas tidak valid (harus diawali angka tingkat)' });
        }
        
        const tingkat = parseInt(tingkatMatch[1]);
        const fase = tingkat <= 2 ? 'A' : tingkat <= 4 ? 'B' : 'C';
        
        console.log('Auto-detected Fase:', fase, 'from tingkat:', tingkat);
        
        // 2. Get students list
        const students = await new Promise((resolve, reject) => {
            db.all(
                `SELECT s.id_siswa, s.nama_siswa
                 FROM siswa s
                 INNER JOIN SiswaKelas sk ON s.id_siswa = sk.id_siswa
                 WHERE sk.id_kelas = ? AND sk.id_ta_semester = ?
                 ORDER BY s.nama_siswa`,
                [id_kelas, id_ta_semester],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
        
        if (!students || students.length === 0) {
            return res.status(404).json({ message: 'Tidak ada siswa di kelas ini' });
        }
        
        // 3. Get TP list from ATP Excel (filtered by semester) - Direct function call instead of HTTP
        console.log('Getting TP list for:', { id_mapel, fase, id_kelas, semester: classInfo.semester, id_ta_semester });
        const tpList = await getTpListDirect(db, id_mapel, fase, id_kelas, classInfo.semester, id_ta_semester);
        console.log('TP List result:', tpList ? `${tpList.length} items` : 'null/empty');
        
        if (!tpList || tpList.length === 0) {
            console.log('ERROR: No TP found for this class/semester');
            return res.status(404).json({ message: 'Tidak ada TP untuk kelas dan semester ini' });
        }
        
        // 4. Get all grades for all students
        const allGrades = await new Promise((resolve, reject) => {
            db.all(
                `SELECT id_siswa, jenis_nilai, urutan_tp, nilai
                 FROM nilai
                 WHERE id_guru = ? AND id_mapel = ? AND id_kelas = ? AND id_ta_semester = ?`,
                [id_guru, id_mapel, id_kelas, id_ta_semester],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
        
        // Create grades map for quick lookup
        const gradesMap = {};
        allGrades.forEach(grade => {
            if (!gradesMap[grade.id_siswa]) {
                gradesMap[grade.id_siswa] = {};
            }
            if (grade.jenis_nilai === 'TP') {
                gradesMap[grade.id_siswa][`TP${grade.urutan_tp}`] = grade.nilai;
            } else {
                gradesMap[grade.id_siswa][grade.jenis_nilai] = grade.nilai;
            }
        });
        
        // 5. Create Excel workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Nilai Final');
        
        // 6. Set column headers
        const headers = ['No', 'ID Siswa', 'Nama Siswa'];
        
        // Add TP columns - use actual urutan_tp from data
        tpList.forEach((tp) => {
            const tpNumber = tp.urutan_tp || (tpList.indexOf(tp) + 1);
            headers.push(`TP${tpNumber}`);
        });
        
        // Add summary columns
        headers.push('Rata-rata TP', 'UAS', 'Nilai Akhir');
        
        // 7. Style header row
        const headerRow = worksheet.addRow(headers);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4472C4' }
        };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
        headerRow.height = 25;
        
        // 8. Add student data rows
        students.forEach((student, index) => {
            const studentGrades = gradesMap[student.id_siswa] || {};
            const rowData = [
                index + 1,
                student.id_siswa,
                student.nama_siswa
            ];
            
            // Add TP grades - use actual urutan_tp from data
            const tpColumns = [];
            tpList.forEach((tp, tpIndex) => {
                const tpNumber = tp.urutan_tp || (tpIndex + 1);
                const tpKey = `TP${tpNumber}`;
                const tpValue = studentGrades[tpKey];
                rowData.push(tpValue !== undefined ? tpValue : '');
                
                // Track column letter for formula
                if (tpValue !== undefined) {
                    const colLetter = String.fromCharCode(68 + tpIndex); // D, E, F, ...
                    tpColumns.push(colLetter);
                }
            });
            
            const currentRow = index + 2; // +2 because row 1 is header, start from row 2
            
            // Rata-rata TP (average of TP columns)
            const rataRataCol = String.fromCharCode(68 + tpList.length); // Column after last TP
            if (tpColumns.length > 0) {
                const tpRange = `D${currentRow}:${String.fromCharCode(67 + tpList.length)}${currentRow}`;
                rowData.push({ formula: `AVERAGE(${tpRange})` });
            } else {
                rowData.push('');
            }
            
            // UAS
            const uasCol = String.fromCharCode(69 + tpList.length); // Column after Rata-rata TP
            rowData.push(studentGrades.UAS !== undefined ? studentGrades.UAS : '');
            
            // Nilai Akhir: (70% Rata TP + 30% UAS)
            const nilaiAkhirFormula = `(${rataRataCol}${currentRow}*0.7)+(${uasCol}${currentRow}*0.3)`;
            rowData.push({ formula: nilaiAkhirFormula });
            
            const row = worksheet.addRow(rowData);
            
            // Alternate row colors
            if (index % 2 === 0) {
                row.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF0F0F0' }
                };
            }
        });
        
        // 9. Format columns
        worksheet.columns.forEach((column, index) => {
            if (index === 0) { // No
                column.width = 5;
            } else if (index === 1) { // ID Siswa
                column.width = 12;
            } else if (index === 2) { // Nama Siswa
                column.width = 25;
            } else {
                column.width = 10;
            }
            
            column.alignment = { vertical: 'middle', horizontal: 'center' };
        });
        
        // Left align for nama siswa
        worksheet.getColumn(3).alignment = { vertical: 'middle', horizontal: 'left' };
        
        // 10. Add borders to all cells
        worksheet.eachRow((row, rowNumber) => {
            row.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
        });
        
        // 11. Freeze first row and first 3 columns
        worksheet.views = [
            { state: 'frozen', xSplit: 3, ySplit: 1 }
        ];
        
        // 12. Generate filename
        const sanitize = (str) => {
            if (!str) return 'Unknown';
            return str.toString().replace(/[^a-zA-Z0-9]/g, '_');
        };
        const timestamp = new Date().getTime();
        const filename = `Nilai_${sanitize(classInfo.nama_mapel)}_${sanitize(classInfo.nama_kelas)}_${sanitize(classInfo.semester)}_${sanitize(classInfo.tahun_ajaran)}_${timestamp}.xlsx`;
        
        console.log('Generated filename:', filename);
        
        // 13. Send file
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        
        await workbook.xlsx.write(res);
        res.end();
        
    } catch (err) {
        console.error('Error exporting final grades:', err);
        console.error('Error stack:', err.stack);
        res.status(500).json({ 
            message: 'Gagal export nilai final', 
            error: err.message,
            details: err.stack
        });
    }
};
