import React, { useState, useEffect } from 'react';
import { fetchGuruAnalytics, fetchStudentAnalytics } from '../../api/analytics';
import { 
    LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
    Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { ALLOWED_MAPEL_WALI, SCHOOL_CLASSES, normalizeName } from '../../config/constants';

// Template Components
import ModuleContainer from '../../components/ModuleContainer';
import PageHeader from '../../components/PageHeader';
import FormSection from '../../components/FormSection';
import LoadingSpinner from '../../components/LoadingSpinner';
import StatusMessage from '../../components/StatusMessage';
import EmptyState from '../../components/EmptyState';

const GuruAnalytics = ({ idGuru }) => {
    const [activeTab, setActiveTab] = useState('subject');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Subject analytics state
    const [guruData, setGuruData] = useState([]);
    const [mataPelajaranList, setMataPelajaranList] = useState([]);
    const [selectedMapel, setSelectedMapel] = useState('all');
    const [selectedKelas, setSelectedKelas] = useState('all');
    const [kelasList, setKelasList] = useState([]);

    // Student analytics state
    const [studentId, setStudentId] = useState('');
    const [studentData, setStudentData] = useState(null);
    const [selectedMapelStudent, setSelectedMapelStudent] = useState('all');
    const [studentList, setStudentList] = useState([]);

    // Extract unique mapel, kelas, and siswa from guru data
    useEffect(() => {
        if (guruData.length > 0) {
            const mapelMap = new Map();
            guruData.forEach(item => {
                if (!mapelMap.has(item.id_mapel)) {
                    mapelMap.set(item.id_mapel, { id: item.id_mapel, nama: item.nama_mapel });
                }
            });
            const kelasMap = new Map();
            guruData.forEach(item => {
                if (!kelasMap.has(item.id_kelas)) {
                    kelasMap.set(item.id_kelas, { id: item.id_kelas, nama: item.nama_kelas });
                }
            });
            // Extract unique students from the kelas guru ajar
            const siswaMap = new Map();
            guruData.forEach(item => {
                if (item.id_siswa && item.nama_siswa) {
                    if (!siswaMap.has(item.id_siswa)) {
                        siswaMap.set(item.id_siswa, { 
                            id: item.id_siswa, 
                            nama: item.nama_siswa,
                            kelas: item.nama_kelas
                        });
                    }
                }
            });

            const uniqueMapel = Array.from(mapelMap.values());
            const uniqueKelas = Array.from(kelasMap.values());
            const uniqueSiswa = Array.from(siswaMap.values()).sort((a, b) => a.nama.localeCompare(b.nama));

            const allowedMapelSet = new Set(ALLOWED_MAPEL_WALI.map(normalizeName));
            const allowedClassSet = new Set(SCHOOL_CLASSES.map(normalizeName));

            const filteredMapel = uniqueMapel.filter(m => allowedMapelSet.has(normalizeName(m.nama)));
            const filteredKelas = uniqueKelas.filter(k => allowedClassSet.has(normalizeName(k.nama)));

            setMataPelajaranList(filteredMapel);
            setKelasList(filteredKelas);
            setStudentList(uniqueSiswa);
        }
    }, [guruData]);

    // Auto-load guru data on moun
    useEffect(() => {
        if (idGuru) {
            loadGuruAnalytics();
        }
    }, [idGuru]);

    // Reload when filters change
    useEffect(() => {
        if (idGuru && activeTab === 'subject') {
            loadGuruAnalytics();
        }
    }, [selectedMapel, selectedKelas]);

    const loadGuruAnalytics = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = {};
            if (selectedMapel && selectedMapel !== 'all') params.id_mapel = selectedMapel;
            if (selectedKelas && selectedKelas !== 'all') params.id_kelas = selectedKelas;

            const result = await fetchGuruAnalytics(idGuru, params);
            setGuruData(result.data || []);
        } catch (err) {
            setError('Gagal memuat data analytics guru');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const loadStudentAnalytics = async () => {
        if (!studentId) {
            setError('Pilih siswa terlebih dahulu');
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const params = (selectedMapelStudent && selectedMapelStudent !== 'all') ? { id_mapel: selectedMapelStudent } : {};
            const result = await fetchStudentAnalytics(studentId, params);
            setStudentData(result);
        } catch (err) {
            setError('Gagal memuat data analytics siswa');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Prepare chart data
    const prepareChartData = (data) => {
        if (!data || data.length === 0) return [];

        const grouped = data.reduce((acc, item) => {
            const key = `${item.tahun_ajaran} ${item.semester}`;
            if (!acc[key]) {
                acc[key] = {
                    period: key,
                    tahun_ajaran: item.tahun_ajaran,
                    semester: item.semester
                };
            }
            
            const label = item.nama_kelas ? 
                `${item.nama_mapel} - ${item.nama_kelas}` : 
                item.nama_mapel;
            
            acc[key][label] = item.rata_rata_kelas || item.rata_keseluruhan;
            return acc;
        }, {});

        return Object.values(grouped);
    };

    // Calculate stats
    const calculateStats = () => {
        if (activeTab === 'subject' && guruData.length > 0) {
            const values = guruData.map(d => parseFloat(d.rata_rata_kelas || 0)).filter(v => v > 0);
            if (values.length === 0) return null;
            
            return {
                totalClasses: new Set(guruData.map(d => d.id_kelas)).size,
                highest: Math.max(...values).toFixed(2),
                average: (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2),
                totalStudents: guruData.reduce((sum, d) => sum + (d.jumlah_siswa || 0), 0)
            };
        }
        
        if (activeTab === 'student' && studentData && studentData.data) {
            const values = studentData.data.map(d => parseFloat(d.rata_keseluruhan || 0)).filter(v => v > 0);
            if (values.length === 0) return null;
            
            return {
                average: (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2),
                highest: Math.max(...values).toFixed(2),
                lowest: Math.min(...values).toFixed(2),
                totalRecords: studentData.data.length
            };
        }
        
        return null;
    };

    const stats = calculateStats();

    return (
        <ModuleContainer>
            <PageHeader
                icon="chart-line"
                title="Analytics Dashboard Guru"
                subtitle="Pantau performa kelas yang Anda ajar dan progress siswa"
            />

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    {activeTab === 'subject' ? (
                        <>
                            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-5 rounded-xl border-2 border-blue-200 shadow-sm">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-gray-600 font-medium mb-1">Total Kelas</p>
                                        <p className="text-3xl font-bold text-blue-700">{stats.totalClasses}</p>
                                    </div>
                                    <div className="bg-blue-500 text-white p-3 rounded-lg">
                                        <i className="fas fa-chalkboard text-2xl"></i>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-gradient-to-br from-green-50 to-green-100 p-5 rounded-xl border-2 border-green-200 shadow-sm">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-gray-600 font-medium mb-1">Tertinggi</p>
                                        <p className="text-3xl font-bold text-green-700">{stats.highest}</p>
                                    </div>
                                    <div className="bg-green-500 text-white p-3 rounded-lg">
                                        <i className="fas fa-trophy text-2xl"></i>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-5 rounded-xl border-2 border-purple-200 shadow-sm">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-gray-600 font-medium mb-1">Rata-rata</p>
                                        <p className="text-3xl font-bold text-purple-700">{stats.average}</p>
                                    </div>
                                    <div className="bg-purple-500 text-white p-3 rounded-lg">
                                        <i className="fas fa-calculator text-2xl"></i>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-5 rounded-xl border-2 border-indigo-200 shadow-sm">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-gray-600 font-medium mb-1">Total Siswa</p>
                                        <p className="text-3xl font-bold text-indigo-700">{stats.totalStudents}</p>
                                    </div>
                                    <div className="bg-indigo-500 text-white p-3 rounded-lg">
                                        <i className="fas fa-users text-2xl"></i>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-5 rounded-xl border-2 border-blue-200 shadow-sm">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-gray-600 font-medium mb-1">Rata-rata</p>
                                        <p className="text-3xl font-bold text-blue-700">{stats.average}</p>
                                    </div>
                                    <div className="bg-blue-500 text-white p-3 rounded-lg">
                                        <i className="fas fa-calculator text-2xl"></i>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-gradient-to-br from-green-50 to-green-100 p-5 rounded-xl border-2 border-green-200 shadow-sm">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-gray-600 font-medium mb-1">Tertinggi</p>
                                        <p className="text-3xl font-bold text-green-700">{stats.highest}</p>
                                    </div>
                                    <div className="bg-green-500 text-white p-3 rounded-lg">
                                        <i className="fas fa-arrow-up text-2xl"></i>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-gradient-to-br from-red-50 to-red-100 p-5 rounded-xl border-2 border-red-200 shadow-sm">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-gray-600 font-medium mb-1">Terendah</p>
                                        <p className="text-3xl font-bold text-red-700">{stats.lowest}</p>
                                    </div>
                                    <div className="bg-red-500 text-white p-3 rounded-lg">
                                        <i className="fas fa-arrow-down text-2xl"></i>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-5 rounded-xl border-2 border-purple-200 shadow-sm">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-gray-600 font-medium mb-1">Total Data</p>
                                        <p className="text-3xl font-bold text-purple-700">{stats.totalRecords}</p>
                                    </div>
                                    <div className="bg-purple-500 text-white p-3 rounded-lg">
                                        <i className="fas fa-database text-2xl"></i>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Tabs */}
            <div className="mb-6 border-b-2 border-gray-200">
                <div className="flex space-x-2">
                    <button
                        onClick={() => setActiveTab('subject')}
                        className={`px-6 py-3 font-semibold transition-all ${
                            activeTab === 'subject'
                                ? 'border-b-4 border-blue-500 text-blue-600 bg-blue-50'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                        }`}
                    >
                        <i className="fas fa-book-open mr-2"></i>
                        Mata Pelajaran Saya
                    </button>
                    <button
                        onClick={() => setActiveTab('student')}
                        className={`px-6 py-3 font-semibold transition-all ${
                            activeTab === 'student'
                                ? 'border-b-4 border-purple-500 text-purple-600 bg-purple-50'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                        }`}
                    >
                        <i className="fas fa-user-graduate mr-2"></i>
                        Progress Siswa
                    </button>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <StatusMessage
                    type="error"
                    message={error}
                    onClose={() => setError(null)}
                />
            )}

            {/* Loading State */}
            {loading && <LoadingSpinner text="Memuat data analytics..." />}

            {/* Subject Analytics Tab */}
            {activeTab === 'subject' && !loading && (
                <div>
                    <FormSection title="Filter Kelas yang Diajar" icon="filter" variant="info">
                        <div className="flex gap-4 items-end">
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    <i className="fas fa-book mr-2 text-blue-500"></i>
                                    Mata Pelajaran
                                </label>
                                <select
                                    value={selectedMapel}
                                    onChange={(e) => setSelectedMapel(e.target.value)}
                                    className="input-field w-full"
                                >
                                    <option value="all">Semua Mata Pelajaran</option>
                                    {mataPelajaranList.map((mapel, idx) => (
                                        <option key={idx} value={mapel.id}>{mapel.nama}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    <i className="fas fa-school mr-2 text-blue-500"></i>
                                    Kelas
                                </label>
                                <select
                                    value={selectedKelas}
                                    onChange={(e) => setSelectedKelas(e.target.value)}
                                    className="input-field w-full"
                                >
                                    <option value="all">Semua Kelas</option>
                                    {kelasList.map((kelas, idx) => (
                                        <option key={idx} value={kelas.id}>{kelas.nama}</option>
                                    ))}
                                </select>
                            </div>
                            <button
                                onClick={loadGuruAnalytics}
                                disabled={loading}
                                className="btn-primary"
                            >
                                <i className="fas fa-sync-alt mr-2"></i>
                                Refresh Data
                            </button>
                        </div>
                    </FormSection>

                    {guruData.length > 0 ? (
                        <>
                            {/* Chart */}
                            <div className="mb-6 bg-white p-6 rounded-xl border-2 border-gray-200 shadow-sm">
                                <h3 className="text-lg font-semibold mb-4 text-gray-800">
                                    <i className="fas fa-chart-line text-blue-500 mr-2"></i>
                                    Trend Nilai Kelas yang Diajar
                                </h3>
                                <ResponsiveContainer width="100%" height={400}>
                                    <BarChart data={prepareChartData(guruData)}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis 
                                            dataKey="period" 
                                            angle={-45} 
                                            textAnchor="end" 
                                            height={100} 
                                            style={{ fontSize: '12px' }}
                                        />
                                        <YAxis 
                                            domain={[0, 100]} 
                                            label={{ value: 'Nilai Rata-rata', angle: -90, position: 'insideLeft' }}
                                        />
                                        <Tooltip />
                                        <Legend />
                                        {guruData.length > 0 && Object.keys(prepareChartData(guruData)[0] || {})
                                            .filter(key => key !== 'period' && key !== 'tahun_ajaran' && key !== 'semester')
                                            .map((key, idx) => (
                                                <Bar
                                                    key={idx}
                                                    dataKey={key}
                                                    fill={`hsl(${idx * 60}, 70%, 50%)`}
                                                />
                                            ))}
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Detail Table */}
                            <div className="overflow-x-auto bg-white rounded-xl border-2 border-gray-200 shadow-sm">
                                <table className="min-w-full">
                                    <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                                        <tr>
                                            <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 border-b-2">Mata Pelajaran</th>
                                            <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 border-b-2">Kelas</th>
                                            <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 border-b-2">Periode</th>
                                            <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700 border-b-2">Rata-rata Kelas</th>
                                            <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700 border-b-2">Jumlah Siswa</th>
                                            <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700 border-b-2">Terendah</th>
                                            <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700 border-b-2">Tertinggi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {guruData.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-6 py-4 text-sm text-gray-900">{item.nama_mapel}</td>
                                                <td className="px-6 py-4 text-sm text-gray-900">{item.nama_kelas}</td>
                                                <td className="px-6 py-4 text-sm text-gray-700">{item.tahun_ajaran} {item.semester}</td>
                                                <td className="px-6 py-4 text-center text-sm font-bold text-blue-600">{item.rata_rata_kelas || '-'}</td>
                                                <td className="px-6 py-4 text-center text-sm text-gray-700">{item.jumlah_siswa || 0}</td>
                                                <td className="px-6 py-4 text-center text-sm font-semibold text-red-600">{item.nilai_terendah || '-'}</td>
                                                <td className="px-6 py-4 text-center text-sm font-semibold text-green-600">{item.nilai_tertinggi || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    ) : (
                        <EmptyState
                            icon="book-open"
                            title="Belum Ada Data Analytics"
                            description="Belum ada data analytics untuk mata pelajaran yang Anda ajar. Silakan input nilai terlebih dahulu."
                        />
                    )}
                </div>
            )}

            {/* Student Analytics Tab */}
            {activeTab === 'student' && !loading && (
                <div>
                    <FormSection title="Cari Progress Siswa" icon="search" variant="warning">
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    <i className="fas fa-user-graduate mr-2 text-purple-500"></i>
                                    Pilih Siswa
                                </label>
                                <select
                                    value={studentId}
                                    onChange={(e) => setStudentId(e.target.value)}
                                    className="input-field w-full"
                                >
                                    <option value="">-- Pilih Siswa --</option>
                                    {studentList.length > 0 ? (
                                        studentList.map((siswa, idx) => (
                                            <option key={idx} value={siswa.id}>
                                                {siswa.nama} ({siswa.kelas})
                                            </option>
                                        ))
                                    ) : (
                                        <option disabled>Tidak ada siswa ditemukan</option>
                                    )}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    <i className="fas fa-book mr-2 text-purple-500"></i>
                                    Mata Pelajaran
                                </label>
                                <select
                                    value={selectedMapelStudent}
                                    onChange={(e) => setSelectedMapelStudent(e.target.value)}
                                    className="input-field w-full"
                                >
                                    <option value="all">Semua Mata Pelajaran</option>
                                    {mataPelajaranList.map((mapel, idx) => (
                                        <option key={idx} value={mapel.id}>{mapel.nama}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">&nbsp;</label>
                                <button
                                    onClick={loadStudentAnalytics}
                                    disabled={loading}
                                    className="btn-primary w-full"
                                >
                                    <i className="fas fa-search mr-2"></i>
                                    Lihat Progress
                                </button>
                            </div>
                        </div>
                    </FormSection>

                    {studentData && (
                        <>
                            <div className="mb-6 p-5 bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-200 rounded-xl">
                                <div className="flex items-center gap-4">
                                    <div className="bg-purple-500 text-white p-4 rounded-full">
                                        <i className="fas fa-user-graduate text-2xl"></i>
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-800">{studentData.student.nama_siswa}</h3>
                                        <p className="text-sm text-gray-600">
                                            <i className="fas fa-id-badge mr-2"></i>
                                            ID: {studentData.student.id_siswa} | 
                                            <i className="fas fa-calendar ml-3 mr-2"></i>
                                            Angkatan: {studentData.student.tahun_ajaran_masuk}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {studentData.data && studentData.data.length > 0 ? (
                                <>
                                    {/* Chart */}
                                    <div className="mb-6 bg-white p-6 rounded-xl border-2 border-gray-200 shadow-sm">
                                        <h3 className="text-lg font-semibold mb-4 text-gray-800">
                                            <i className="fas fa-chart-line text-purple-500 mr-2"></i>
                                            Progress Akademik Siswa
                                        </h3>
                                        <ResponsiveContainer width="100%" height={400}>
                                            <BarChart data={prepareChartData(studentData.data)}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis 
                                                    dataKey="period" 
                                                    angle={-45} 
                                                    textAnchor="end" 
                                                    height={100} 
                                                    style={{ fontSize: '12px' }}
                                                />
                                                <YAxis 
                                                    domain={[0, 100]} 
                                                    label={{ value: 'Nilai Rata-rata', angle: -90, position: 'insideLeft' }}
                                                />
                                                <Tooltip />
                                                <Legend />
                                                {studentData.data.length > 0 && 
                                                    [...new Set(studentData.data.map(d => d.nama_mapel))].map((mapel, idx) => (
                                                        <Bar
                                                            key={idx}
                                                            dataKey={mapel}
                                                            fill={`hsl(${idx * 90}, 70%, 50%)`}
                                                        />
                                                    ))
                                                }
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>

                                    {/* Data Table */}
                                    <div className="overflow-x-auto bg-white rounded-xl border-2 border-gray-200 shadow-sm">
                                        <table className="min-w-full">
                                            <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                                                <tr>
                                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 border-b-2">Mata Pelajaran</th>
                                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 border-b-2">Periode</th>
                                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 border-b-2">Kelas</th>
                                                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700 border-b-2">Rata TP</th>
                                                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700 border-b-2">UAS</th>
                                                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700 border-b-2">Nilai Akhir</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200">
                                                {studentData.data.map((item, idx) => (
                                                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                                        <td className="px-6 py-4 text-sm text-gray-900">{item.nama_mapel}</td>
                                                        <td className="px-6 py-4 text-sm text-gray-700">{item.tahun_ajaran} {item.semester}</td>
                                                        <td className="px-6 py-4 text-sm text-gray-700">{item.nama_kelas}</td>
                                                        <td className="px-6 py-4 text-center text-sm text-gray-700">{item.rata_tp || '-'}</td>
                                                        <td className="px-6 py-4 text-center text-sm text-gray-700">{item.nilai_uas || '-'}</td>
                                                        <td className="px-6 py-4 text-center text-sm font-bold text-purple-600">{item.rata_keseluruhan}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            ) : (
                                <EmptyState
                                    icon="clipboard-list"
                                    title="Belum Ada Data Nilai"
                                    description="Siswa ini belum memiliki data nilai."
                                />
                            )}
                        </>
                    )}
                </div>
            )}
        </ModuleContainer>
    );
};

export default GuruAnalytics;
