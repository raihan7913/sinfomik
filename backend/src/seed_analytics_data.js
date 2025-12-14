// backend/src/seed_analytics_data.js
// Script untuk menambahkan data dummy untuk analytics
const { getDb } = require('./config/db');
const { format } = require('date-fns');

async function seedAnalyticsData() {
    const db = getDb();
    const allowedKelasNames = [
        '1 Gumujeng', '1 Someah', '1 Darehdeh',
        '2 Gentur', '2 Rancage', '2 Daria',
        '3 Calakan', '3 Singer', '3 Rancingeus',
        '4 Jatmika', '4 Gumanti', '4 Marahmay',
        '5 Rucita', '5 Binangkit', '5 Macakal',
        '6 Gumilang', '6 Sonagar', '6 Parigel'
    ];

    const runQuery = (sql, params = []) => {
        return new Promise((resolve, reject) => {
            db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve(this.lastID || this.changes);
            });
        });
    };

    const getQuery = (sql, params = []) => {
        return new Promise((resolve, reject) => {
            db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    };

    const allQuery = (sql, params = []) => {
        return new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    };

    // --- Hapus kelas lama dan data terkait sebelum seeding ---
    try {
        const kelasLama = await allQuery(`SELECT id_kelas, nama_kelas FROM Kelas WHERE nama_kelas NOT IN (${allowedKelasNames.map(() => '?').join(',')})`, allowedKelasNames);
        if (kelasLama.length > 0) {
            console.log(`\n🧹 Menghapus kelas lama dan data terkait...`);
            for (const kelas of kelasLama) {
                await runQuery('DELETE FROM Nilai WHERE id_kelas = ?', [kelas.id_kelas]);
                await runQuery('DELETE FROM SiswaKelas WHERE id_kelas = ?', [kelas.id_kelas]);
                await runQuery('DELETE FROM GuruMataPelajaranKelas WHERE id_kelas = ?', [kelas.id_kelas]);
                await runQuery('DELETE FROM Kelas WHERE id_kelas = ?', [kelas.id_kelas]);
                console.log(`  ✅ Kelas lama dihapus: ${kelas.nama_kelas}`);
            }
            // Pastikan data orphan di Nilai, SiswaKelas, GuruMataPelajaranKelas juga dihapus
            await runQuery(`DELETE FROM Nilai WHERE id_kelas NOT IN (SELECT id_kelas FROM Kelas)`);
            await runQuery(`DELETE FROM SiswaKelas WHERE id_kelas NOT IN (SELECT id_kelas FROM Kelas)`);
            await runQuery(`DELETE FROM GuruMataPelajaranKelas WHERE id_kelas NOT IN (SELECT id_kelas FROM Kelas)`);
            console.log('  ✅ Data orphan kelas lama dihapus dari semua relasi.');
        }
    } catch (err) {
        console.error('❌ Error saat menghapus kelas lama:', err);
    }

    try {
        console.log('🚀 Starting to seed analytics data...\n');

        // Get all existing data
        const allSiswa = await allQuery('SELECT * FROM Siswa ORDER BY id_siswa');
        const allGuru = await allQuery('SELECT * FROM Guru ORDER BY id_guru');
        const allMapel = await allQuery('SELECT * FROM MataPelajaran ORDER BY id_mapel');
        const allTASemester = await allQuery('SELECT * FROM TahunAjaranSemester ORDER BY tahun_ajaran, semester');
        const allKelas = await allQuery('SELECT * FROM Kelas ORDER BY id_kelas');

        console.log(`📊 Found: ${allSiswa.length} siswa, ${allGuru.length} guru, ${allMapel.length} mapel, ${allTASemester.length} TA/Semester`);

        // Add more TA/Semester if needed
        const requiredTASemesters = [
            { tahun_ajaran: '2022/2023', semester: 'Ganjil', is_aktif: false },
            { tahun_ajaran: '2022/2023', semester: 'Genap', is_aktif: false },
            { tahun_ajaran: '2023/2024', semester: 'Ganjil', is_aktif: false },
            { tahun_ajaran: '2023/2024', semester: 'Genap', is_aktif: false },
            { tahun_ajaran: '2024/2025', semester: 'Ganjil', is_aktif: true },
            { tahun_ajaran: '2024/2025', semester: 'Genap', is_aktif: false },
        ];

        console.log('\n📅 Ensuring all TA/Semester exist...');
        for (const tas of requiredTASemesters) {
            const existing = await getQuery(
                'SELECT id_ta_semester FROM TahunAjaranSemester WHERE tahun_ajaran = ? AND semester = ?',
                [tas.tahun_ajaran, tas.semester]
            );
            
            if (!existing) {
                await runQuery(
                    'INSERT INTO tahunajaransemester (tahun_ajaran, semester, is_aktif) VALUES (?, ?, ?)',
                    [tas.tahun_ajaran, tas.semester, tas.is_aktif]
                );
                console.log(`  ✅ Added: ${tas.tahun_ajaran} ${tas.semester}`);
            }
        }

        // Refresh TA/Semester list
        const updatedTASemester = await allQuery('SELECT * FROM TahunAjaranSemester ORDER BY tahun_ajaran, semester');
        console.log(`  Total TA/Semester: ${updatedTASemester.length}`);

        // Add more students if needed (angkatan berbeda)
        const additionalStudents = [
            // Angkatan 2022/2023
            { id_siswa: 2001, nama_siswa: 'Fajar Ramadhan', tanggal_lahir: '2007-04-12', jenis_kelamin: 'L', tahun_ajaran_masuk: '2022/2023' },
            { id_siswa: 2002, nama_siswa: 'Gita Permata', tanggal_lahir: '2007-08-20', jenis_kelamin: 'P', tahun_ajaran_masuk: '2022/2023' },
            { id_siswa: 2003, nama_siswa: 'Hadi Wijaya', tanggal_lahir: '2007-12-05', jenis_kelamin: 'L', tahun_ajaran_masuk: '2022/2023' },
            // Angkatan 2024/2025
            { id_siswa: 3001, nama_siswa: 'Indah Sari', tanggal_lahir: '2009-02-15', jenis_kelamin: 'P', tahun_ajaran_masuk: '2024/2025' },
            { id_siswa: 3002, nama_siswa: 'Joko Susilo', tanggal_lahir: '2009-06-22', jenis_kelamin: 'L', tahun_ajaran_masuk: '2024/2025' },
        ];

        console.log('\n👥 Adding more students (different angkatan)...');
        for (const student of additionalStudents) {
            const existing = await getQuery('SELECT id_siswa FROM Siswa WHERE id_siswa = ?', [student.id_siswa]);
            if (!existing) {
                await runQuery(
                    'INSERT INTO Siswa (id_siswa, nama_siswa, tanggal_lahir, jenis_kelamin, tahun_ajaran_masuk) VALUES (?, ?, ?, ?, ?)',
                    [student.id_siswa, student.nama_siswa, student.tanggal_lahir, student.jenis_kelamin, student.tahun_ajaran_masuk]
                );
                console.log(`  ✅ Added: ${student.nama_siswa} (Angkatan ${student.tahun_ajaran_masuk})`);
            }
        }

        // Refresh student list
        const updatedSiswa = await allQuery('SELECT * FROM Siswa ORDER BY id_siswa');

        // Create kelas sesuai permintaan user
        console.log('\n🏫 Creating kelas untuk semua TA/Semester...');
        for (const tas of updatedTASemester) {
            for (const kelasName of allowedKelasNames) {
                const existing = await getQuery(
                    'SELECT id_kelas FROM Kelas WHERE nama_kelas = ? AND id_ta_semester = ?',
                    [kelasName, tas.id_ta_semester]
                );
                if (!existing && allGuru.length > 0) {
                    const waliKelas = allGuru[Math.floor(Math.random() * allGuru.length)].id_guru;
                    await runQuery(
                        'INSERT INTO Kelas (nama_kelas, id_wali_kelas, id_ta_semester) VALUES (?, ?, ?)',
                        [kelasName, waliKelas, tas.id_ta_semester]
                    );
                    console.log(`  ✅ Created: ${kelasName} for ${tas.tahun_ajaran} ${tas.semester}`);
                }
            }
        }

        // Refresh kelas list
        const updatedKelas = await allQuery('SELECT * FROM Kelas ORDER BY id_kelas');

        // Assign students to kelas (simulate rolling)
        console.log('\n📝 Assigning students to kelas...');
        
        // Untuk siswa yang tidak punya tahun_ajaran_masuk, set ke angkatan saat ini
        for (const siswa of updatedSiswa) {
            if (!siswa.tahun_ajaran_masuk) {
                // Set tahun ajaran masuk ke 2023/2024 sebagai default
                await runQuery('UPDATE Siswa SET tahun_ajaran_masuk = ? WHERE id_siswa = ?', ['2023/2024', siswa.id_siswa]);
                siswa.tahun_ajaran_masuk = '2023/2024';
                console.log(`  ✅ Updated ${siswa.nama_siswa} - set tahun_ajaran_masuk to 2023/2024`);
            }
        }
        
        // Assign siswa ke kelas berdasarkan tahun ajaran
        for (const siswa of updatedSiswa) {
            const tahunMasuk = parseInt(siswa.tahun_ajaran_masuk.split('/')[0]);
            
            for (const tas of updatedTASemester) {
                const currentYear = parseInt(tas.tahun_ajaran.split('/')[0]);
                const yearDiff = currentYear - tahunMasuk;
                
                // Tentukan tingkat kelas berdasarkan selisih tahun
                let tingkat = yearDiff + 1; // Kelas 1, 2, 3, 4, 5, 6
                
                if (tingkat >= 1 && tingkat <= 6) {
                    // Pilih kelas secara acak dari kelas tingkat tersebut
                    const kelasForTingkat = updatedKelas.filter(k => 
                        k.nama_kelas.startsWith(tingkat.toString()) && k.id_ta_semester === tas.id_ta_semester
                    );
                    
                    if (kelasForTingkat.length > 0) {
                        const randomKelas = kelasForTingkat[Math.floor(Math.random() * kelasForTingkat.length)];
                        
                        try {
                            await runQuery(
                                'INSERT OR IGNORE INTO SiswaKelas (id_siswa, id_kelas, id_ta_semester) VALUES (?, ?, ?)',
                                [siswa.id_siswa, randomKelas.id_kelas, tas.id_ta_semester]
                            );
                        } catch (err) {
                            // Ignore duplicate errors
                        }
                    }
                }
            }
        }
        console.log('  ✅ Student assignments complete');

        // Assign guru to mapel & kelas
        console.log('\n👨‍🏫 Assigning guru to mapel & kelas...');
        for (const guru of allGuru) {
            for (const mapel of allMapel) {
                // Assign to some random kelas in each TA/Semester
                for (const tas of updatedTASemester) {
                    const kelasForThisSemester = updatedKelas.filter(k => k.id_ta_semester === tas.id_ta_semester);
                    const randomKelas = kelasForThisSemester[Math.floor(Math.random() * kelasForThisSemester.length)];
                    
                    if (randomKelas) {
                        try {
                            await runQuery(
                                'INSERT OR IGNORE INTO GuruMataPelajaranKelas (id_guru, id_mapel, id_kelas, id_ta_semester) VALUES (?, ?, ?, ?)',
                                [guru.id_guru, mapel.id_mapel, randomKelas.id_kelas, tas.id_ta_semester]
                            );
                        } catch (err) {
                            // Ignore duplicate
                        }
                    }
                }
            }
        }
        console.log('  ✅ Guru assignments complete');

        // Generate NILAI data (the most important part!)
        console.log('\n📊 Generating nilai data for analytics...');
        let nilaiCount = 0;

        for (const tas of updatedTASemester) {
            console.log(`\n  Processing: ${tas.tahun_ajaran} ${tas.semester}`);
            
            const kelasInThisSemester = updatedKelas.filter(k => k.id_ta_semester === tas.id_ta_semester);
            
            for (const kelas of kelasInThisSemester) {
                // Get students in this kelas
                const siswaInKelas = await allQuery(
                    'SELECT id_siswa FROM SiswaKelas WHERE id_kelas = ? AND id_ta_semester = ?',
                    [kelas.id_kelas, tas.id_ta_semester]
                );
                
                // Get guru assignments for this kelas
                const guruMapelInKelas = await allQuery(
                    'SELECT id_guru, id_mapel FROM GuruMataPelajaranKelas WHERE id_kelas = ? AND id_ta_semester = ?',
                    [kelas.id_kelas, tas.id_ta_semester]
                );
                
                // Generate nilai for each student, guru, mapel combination
                for (const siswa of siswaInKelas) {
                    for (const assignment of guruMapelInKelas) {
                        // Generate 3 TP values
                        for (let tp = 1; tp <= 3; tp++) {
                            const baseScore = 70 + Math.random() * 25; // 70-95
                            const variance = (Math.random() - 0.5) * 10; // -5 to +5
                            const score = Math.max(60, Math.min(100, baseScore + variance));
                            
                            try {
                                await runQuery(
                                    'INSERT OR REPLACE INTO Nilai (id_siswa, id_guru, id_mapel, id_kelas, id_ta_semester, jenis_nilai, urutan_tp, nilai, tanggal_input, keterangan) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                                    [siswa.id_siswa, assignment.id_guru, assignment.id_mapel, kelas.id_kelas, tas.id_ta_semester, 'TP', tp, Math.round(score * 100) / 100, format(new Date(), 'yyyy-MM-dd HH:mm:ss'), `TP ${tp}`]
                                );
                                nilaiCount++;
                            } catch (err) {
                                // console.error('Error inserting TP:', err.message);
                            }
                        }
                        
                        // Generate UAS value
                        const uasScore = 75 + Math.random() * 20; // 75-95
                        try {
                            await runQuery(
                                'INSERT OR REPLACE INTO Nilai (id_siswa, id_guru, id_mapel, id_kelas, id_ta_semester, jenis_nilai, urutan_tp, nilai, tanggal_input, keterangan) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                                [siswa.id_siswa, assignment.id_guru, assignment.id_mapel, kelas.id_kelas, tas.id_ta_semester, 'UAS', null, Math.round(uasScore * 100) / 100, format(new Date(), 'yyyy-MM-dd HH:mm:ss'), 'UAS']
                            );
                            nilaiCount++;
                        } catch (err) {
                            // console.error('Error inserting UAS:', err.message);
                        }
                    }
                }
            }
            console.log(`    ✅ Generated nilai for ${tas.tahun_ajaran} ${tas.semester}`);
        }

        console.log(`\n✅ Total nilai entries created: ${nilaiCount}`);
        console.log('\n🎉 Analytics data seeding complete!\n');
        console.log('📊 You can now view:');
        console.log('   - School Analytics (trend across years)');
        console.log('   - Angkatan Analytics (cohort tracking)');
        console.log('   - Student Historical Records (kenang-kenangan)');
        console.log('   - Guru Subject Analytics (teaching effectiveness)\n');

    } catch (error) {
        console.error('❌ Error seeding analytics data:', error);
        process.exit(1);
    }

// Run the seeding
seedAnalyticsData();
}
