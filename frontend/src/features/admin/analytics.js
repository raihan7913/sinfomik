import React, { useState, useEffect, useRef } from 'react';
import { 
    fetchSchoolAnalytics, 
    fetchAngkatanAnalytics, 
    fetchAngkatanList,
    fetchStudentAnalytics,
    fetchStudentMapelDetails
} from '../../api/analytics';
import { 
    LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
    Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Template Components
import ModuleContainer from '../../components/ModuleContainer';
import PageHeader from '../../components/PageHeader';
import FormSection from '../../components/FormSection';
import LoadingSpinner from '../../components/LoadingSpinner';
import StatusMessage from '../../components/StatusMessage';
import EmptyState from '../../components/EmptyState';

const AdminAnalytics = () => {
    // State management
    const [activeTab, setActiveTab] = useState('school');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Refs for capturing charts
    const schoolChartRef = useRef(null);
    const angkatanChartRef = useRef(null);
    const studentChartRef = useRef(null);

    // School analytics state
    const [schoolData, setSchoolData] = useState([]);
    const [selectedMapelSchool, setSelectedMapelSchool] = useState('all');
    const [mataPelajaranList, setMataPelajaranList] = useState([]);
    // Rentang tahun ajaran (1..7) - default 1 tahun (mencakup Ganjil & Genap)
    const [yearRange, setYearRange] = useState(1);

    // Angkatan analytics state
    const [angkatanData, setAngkatanData] = useState([]);
    const [angkatanList, setAngkatanList] = useState([]);
    const [selectedAngkatan, setSelectedAngkatan] = useState('');
    const [selectedMapelAngkatan, setSelectedMapelAngkatan] = useState('all');

    // Student analytics state
    const [studentData, setStudentData] = useState(null);
    const [studentId, setStudentId] = useState('');
    const [selectedMapelStudent, setSelectedMapelStudent] = useState('all');

    // Mapel detail modal state
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [detailModalLoading, setDetailModalLoading] = useState(false);
    const [detailModalData, setDetailModalData] = useState([]);
    const [detailModalMapelName, setDetailModalMapelName] = useState('');

    const handleShowMapelDetails = async (item) => {
        if (!studentId) {
            setError('Pilih siswa terlebih dahulu');
            return;
        }
        setDetailModalLoading(true);
        setDetailModalOpen(true);
        setDetailModalData([]);
        setDetailModalMapelName(item.nama_mapel || 'Mapel');
        try {
            const params = {};
            if (item.id_ta_semester) params.id_ta_semester = item.id_ta_semester;
            const res = await fetchStudentMapelDetails(studentId, item.id_mapel, params);
            // res may include { data: [...] } or be the array — handle both
            const rows = res && res.data ? res.data : (Array.isArray(res) ? res : []);
            setDetailModalData(rows);
        } catch (err) {
            console.error('Error fetching mapel details:', err);
            setError('Gagal memuat detail mapel siswa');
            setDetailModalData([]);
        } finally {
            setDetailModalLoading(false);
        }
    };

    const handleCloseDetailModal = () => {
        setDetailModalOpen(false);
        setDetailModalData([]);
        setDetailModalMapelName('');
    };

    // Fetch mata pelajaran list from school data
    useEffect(() => {
        if (schoolData.length > 0 && mataPelajaranList.length === 0) {
            const mapelMap = new Map();
            schoolData.forEach(item => {
                if (!mapelMap.has(item.id_mapel)) {
                    mapelMap.set(item.id_mapel, {
                        id: item.id_mapel,
                        nama: item.nama_mapel
                    });
                }
            });
            setMataPelajaranList(Array.from(mapelMap.values()));
        }
    }, [schoolData]);

    // Fetch angkatan list on mount
    useEffect(() => {
        loadAngkatanList();
    }, []);

    const loadAngkatanList = async () => {
        try {
            const data = await fetchAngkatanList();
            setAngkatanList(data);
            if (data.length > 0) {
                setSelectedAngkatan(data[0].angkatan);
            }
        } catch (err) {
            console.error('Error loading angkatan list:', err);
        }
    };

    // Export chart to PDF
    const exportChartToPDF = async (chartRef, filename, title, tableData, tabType, studentInfo = null) => {
        if (!chartRef.current) {
            alert('Grafik tidak tersedia untuk di-export!');
            return;
        }

        try {
            const canvas = await html2canvas(chartRef.current, {
                scale: 3,
                backgroundColor: '#ffffff',
                logging: false,
                useCORS: true,
                allowTaint: true
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            let yPosition = 0;

            // Header
            pdf.setFillColor(41, 128, 185);
            pdf.rect(0, 0, pageWidth, 50, 'F');

            try {
                const logoImg = new Image();
                logoImg.src = '/logo-binekas.png';
                await new Promise((resolve, reject) => {
                    logoImg.onload = resolve;
                    logoImg.onerror = reject;
                    setTimeout(reject, 3000);
                });
                
                const logoSize = 30;
                pdf.addImage(logoImg, 'PNG', 15, 10, logoSize, logoSize);
            } catch (err) {
                console.warn('Logo could not be loaded:', err);
            }

            pdf.setFontSize(16);
            pdf.setTextColor(255, 255, 255);
            pdf.setFont('helvetica', 'bold');
            pdf.text('SD BINEKAS', pageWidth / 2, 20, { align: 'center' });
            
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'normal');
            pdf.text('Laporan Analitik Akademik', pageWidth / 2, 28, { align: 'center' });
            
            if (studentInfo && tabType === 'student') {
                pdf.setFontSize(9);
                pdf.text(`${studentInfo.nama} (NIS: ${studentInfo.id})`, pageWidth / 2, 35, { align: 'center' });
            }

            pdf.setDrawColor(255, 255, 255);
            pdf.setLineWidth(0.5);
            pdf.line(15, 47, pageWidth - 15, 47);

            yPosition = 57;

            pdf.setTextColor(0, 0, 0);
            pdf.setFontSize(13);
            pdf.setFont('helvetica', 'bold');
            pdf.text(title, pageWidth / 2, yPosition, { align: 'center' });
            yPosition += 8;

            // Chart
            const imgWidth = pageWidth - 20;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            const maxImgHeight = 120;
            const finalImgHeight = Math.min(imgHeight, maxImgHeight);

            pdf.addImage(imgData, 'PNG', 10, yPosition, imgWidth, finalImgHeight);
            yPosition += finalImgHeight + 8;

            // Table
            if (tableData && tableData.length > 0) {
                pdf.setFontSize(11);
                pdf.setFont('helvetica', 'bold');
                pdf.setTextColor(41, 128, 185);
                pdf.text('Tabel Data Nilai', 15, yPosition);
                yPosition += 2;

                let headers = [];
                let rows = [];

                if (tabType === 'student') {
                    headers = ['Mata Pelajaran', 'Periode', 'Nilai'];
                    rows = tableData.map(item => {
                        const nilai = parseFloat(item.rata_keseluruhan || item.nilai || 0);
                        return [
                            item.nama_mapel || '-',
                            `${item.tahun_ajaran || '-'} - Sem ${item.semester || '-'}`,
                            nilai > 0 ? nilai.toFixed(2) : '-'
                        ];
                    });
                } else if (tabType === 'school') {
                    headers = ['Mata Pelajaran', 'Periode', 'Rata-rata', 'Siswa', 'Min', 'Max'];
                    rows = tableData.map(item => [
                        item.nama_mapel || '-',
                        `${item.tahun_ajaran || '-'} - Sem ${item.semester || '-'}`,
                        item.rata_rata_sekolah || '-',
                        item.jumlah_siswa || '0',
                        item.nilai_terendah || '-',
                        item.nilai_tertinggi || '-'
                    ]);
                } else if (tabType === 'angkatan') {
                    headers = ['Mata Pelajaran', 'Periode', 'Rata-rata', 'Siswa', 'Min', 'Max'];
                    rows = tableData.map(item => [
                        item.nama_mapel || '-',
                        `${item.tahun_ajaran || '-'} - Sem ${item.semester || '-'}`,
                        item.rata_rata_angkatan || '-',
                        item.jumlah_siswa || '0',
                        item.nilai_terendah || '-',
                        item.nilai_tertinggi || '-'
                    ]);
                }

                let columnStyles = {};
                if (tabType === 'student') {
                    columnStyles = {
                        0: { cellWidth: 'auto' },
                        1: { halign: 'center' },
                        2: { halign: 'center', fontStyle: 'bold', textColor: [41, 128, 185] }
                    };
                } else {
                    columnStyles = {
                        0: { cellWidth: 'auto' },
                        1: { halign: 'center' },
                        2: { halign: 'center', fontStyle: 'bold' },
                        3: { halign: 'center' },
                        4: { halign: 'center', textColor: [220, 53, 69] },
                        5: { halign: 'center', textColor: [40, 167, 69] }
                    };
                }

                autoTable(pdf, {
                    head: [headers],
                    body: rows,
                    startY: yPosition + 3,
                    theme: 'striped',
                    headStyles: {
                        fillColor: [41, 128, 185],
                        textColor: [255, 255, 255],
                        fontStyle: 'bold',
                        fontSize: 9,
                        halign: 'center'
                    },
                    bodyStyles: {
                        fontSize: 8,
                        cellPadding: 3
                    },
                    alternateRowStyles: {
                        fillColor: [245, 248, 250]
                    },
                    columnStyles: columnStyles,
                    margin: { left: 15, right: 15 },
                    didDrawPage: function (data) {
                        const footerY = pageHeight - 15;
                        pdf.setDrawColor(41, 128, 185);
                        pdf.setLineWidth(0.5);
                        pdf.line(15, footerY - 5, pageWidth - 15, footerY - 5);

                        pdf.setFontSize(8);
                        pdf.setTextColor(100, 100, 100);
                        pdf.setFont('helvetica', 'normal');

                        const today = new Date().toLocaleDateString('id-ID', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        });

                        pdf.text(`Dicetak: ${today}`, 15, footerY);
                        pdf.text(`Halaman ${data.pageNumber}`, pageWidth - 15, footerY, { align: 'right' });
                    }
                });
            }

            pdf.save(`${filename}.pdf`);
            alert('✅ Laporan PDF berhasil dibuat!');
        } catch (error) {
            console.error('Error exporting to PDF:', error);
            alert('❌ Gagal membuat PDF: ' + error.message);
        }
    };

    // Load school analytics
    const loadSchoolAnalytics = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = (selectedMapelSchool && selectedMapelSchool !== 'all') ? { id_mapel: selectedMapelSchool } : {};
            const result = await fetchSchoolAnalytics(params);
            setSchoolData(result.data || []);
        } catch (err) {
            setError('Gagal memuat data analytics sekolah');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Load angkatan analytics
    const loadAngkatanAnalytics = async () => {
        if (!selectedAngkatan) return;
        
        setLoading(true);
        setError(null);
        try {
            const params = (selectedMapelAngkatan && selectedMapelAngkatan !== 'all') ? { id_mapel: selectedMapelAngkatan } : {};
            const result = await fetchAngkatanAnalytics(selectedAngkatan, params);
            setAngkatanData(result.data || []);
        } catch (err) {
            setError('Gagal memuat data analytics angkatan');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Load student analytics
    const loadStudentAnalytics = async () => {
        if (!studentId) {
            setError('Masukkan ID Siswa');
            return;
        }
        
        setLoading(true);
        setError(null);
        try {
            const params = {};
            if (selectedMapelStudent && selectedMapelStudent !== 'all' && selectedMapelStudent !== '') {
                params.id_mapel = selectedMapelStudent;
            }
            
            const result = await fetchStudentAnalytics(studentId, params);
            setStudentData(result);
            
            if (result.data && result.data.length > 0 && mataPelajaranList.length === 0) {
                const mapelMap = new Map();
                result.data.forEach(item => {
                    if (item.id_mapel && item.nama_mapel && !mapelMap.has(item.id_mapel)) {
                        mapelMap.set(item.id_mapel, {
                            id: item.id_mapel,
                            nama: item.nama_mapel
                        });
                    }
                });
                if (mapelMap.size > 0) {
                    setMataPelajaranList(Array.from(mapelMap.values()));
                }
            }
        } catch (err) {
            setError('Gagal memuat data analytics siswa');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Auto-refresh student analytics when subject changes
    useEffect(() => {
        if (activeTab === 'student' && studentId) {
            loadStudentAnalytics();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedMapelStudent]);

    // Auto-load school data on tab switch
    useEffect(() => {
        if (activeTab === 'school' && schoolData.length === 0) {
            loadSchoolAnalytics();
        }
    }, [activeTab]);

    // Auto-load angkatan data when angkatan or mapel filter changes
    useEffect(() => {
        if (activeTab === 'angkatan' && selectedAngkatan) {
            loadAngkatanAnalytics();
        }
    }, [selectedAngkatan, selectedMapelAngkatan, activeTab]);

    // Prepare chart data
    const prepareChartData = (data) => {
        if (!data || data.length === 0) return [];

        const tempGrouped = {};
        
        data.forEach(item => {
            const periodKey = `${item.tahun_ajaran} ${item.semester}`;
            const value = item.rata_rata_sekolah || item.rata_rata_angkatan || item.rata_keseluruhan;
            
            if (!tempGrouped[periodKey]) {
                tempGrouped[periodKey] = {
                    period: periodKey,
                    tahun_ajaran: item.tahun_ajaran,
                    semester: item.semester,
                    values: []
                };
            }
            
            if (value !== null && value !== undefined) {
                tempGrouped[periodKey].values.push(parseFloat(value));
            }
        });

        const finalGrouped = Object.keys(tempGrouped).map(periodKey => {
            const periodData = tempGrouped[periodKey];
            const values = periodData.values;
            const average = values.reduce((sum, val) => sum + val, 0) / values.length;
            
            return {
                period: periodData.period,
                tahun_ajaran: periodData.tahun_ajaran,
                semester: periodData.semester,
                nilai: parseFloat(average.toFixed(2))
            };
        });

        const sortedData = finalGrouped.sort((a, b) => {
            if (a.tahun_ajaran !== b.tahun_ajaran) {
                return a.tahun_ajaran.localeCompare(b.tahun_ajaran);
            }
            return a.semester === 'Ganjil' ? -1 : 1;
        });

        return sortedData;
    };

    // Helper: group rows by tahun_ajaran and semester
    const groupByYearAndSemester = (rows) => {
        if (!rows || rows.length === 0) return {};
        return rows.reduce((acc, r) => {
            const key = `${r.tahun_ajaran || 'Unknown'} - ${r.semester || 'Unknown'}`;
            if (!acc[key]) {
                acc[key] = {
                    tahun_ajaran: r.tahun_ajaran,
                    semester: r.semester,
                    data: []
                };
            }
            acc[key].data.push(r);
            return acc;
        }, {});
    };



    // Group student data by class and semester
    const groupStudentDataByClassSemester = (data) => {
        if (!data || data.length === 0) return {};

        const grouped = {};
        
        data.forEach(item => {
            // Extract class level (Kelas 1, Kelas 2, etc)
            const classPart = item.nama_kelas ? item.nama_kelas.split(' ')[0] : 'Unknown';
            const semesterPart = item.semester || 'Unknown';
            
            const groupKey = `${classPart} - Semester ${semesterPart}`;
            
            if (!grouped[groupKey]) {
                grouped[groupKey] = {
                    className: classPart,
                    semester: semesterPart,
                    period: `${item.tahun_ajaran || ''}`,
                    data: []
                };
            }
            
            grouped[groupKey].data.push(item);
        });

        // Sort by class level and semester
        const sortedKeys = Object.keys(grouped).sort((a, b) => {
            const aClass = parseInt(grouped[a].className) || 0;
            const bClass = parseInt(grouped[b].className) || 0;
            
            if (aClass !== bClass) return aClass - bClass;
            
            const aSem = grouped[a].semester === 'Ganjil' ? 1 : 2;
            const bSem = grouped[b].semester === 'Ganjil' ? 1 : 2;
            
            return aSem - bSem;
        });

        const result = {};
        sortedKeys.forEach(key => {
            result[key] = grouped[key];
        });

        return result;
    };

    // Calculate stats
    const calculateStats = () => {
        let data = [];
        if (activeTab === 'school') data = schoolData;
        else if (activeTab === 'angkatan') data = angkatanData;
        else if (activeTab === 'student' && studentData) data = studentData.data || [];

        if (!data || data.length === 0) return null;

        const avgField = activeTab === 'school' ? 'rata_rata_sekolah' : 
                        activeTab === 'angkatan' ? 'rata_rata_angkatan' : 
                        'rata_keseluruhan';
        
        const values = data.map(d => parseFloat(d[avgField] || 0)).filter(v => v > 0);
        if (values.length === 0) return null;

        return {
            average: (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2),
            highest: Math.max(...values).toFixed(2),
            lowest: Math.min(...values).toFixed(2),
            totalRecords: data.length
        };
    };

    const stats = calculateStats();

    // Determine available tahun ajaran and apply yearRange filter (most recent years)
    const parseStartYear = (y) => {
        if (!y) return 0;
        const m = String(y).match(/(\d{4})/);
        return m ? parseInt(m[0], 10) : 0;
    };
    const distinctYears = Array.from(new Set(schoolData.map(i => i.tahun_ajaran))).sort((a, b) => parseStartYear(b) - parseStartYear(a));
    const availableYearsCount = distinctYears.length;
    const maxRange = Math.min(7, availableYearsCount || 7);
    const effectiveYearRange = Math.min(yearRange, maxRange || yearRange);
    const yearsToShow = distinctYears.slice(0, effectiveYearRange);
    const filteredSchoolData = availableYearsCount === 0 ? schoolData : schoolData.filter(item => yearsToShow.includes(item.tahun_ajaran));

    return (
        <ModuleContainer>
            <PageHeader
                icon="chart-bar"
                title="Analitik Dasbor"
                subtitle="Analisis lengkap performa akademik sekolah, angkatan, dan siswa"
            />

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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
                </div>
            )}

            {/* Tabs */}
            <div className="mb-6 border-b-2 border-gray-200">
                <div className="flex space-x-2">
                    <button
                        onClick={() => setActiveTab('school')}
                        className={`px-6 py-3 font-semibold transition-all ${
                            activeTab === 'school'
                                ? 'border-b-4 border-blue-500 text-blue-600 bg-blue-50'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                        }`}
                    >
                        <i className="fas fa-school mr-2"></i>
                        Analisis Sekolah
                    </button>
                    <button
                        onClick={() => setActiveTab('angkatan')}
                        className={`px-6 py-3 font-semibold transition-all ${
                            activeTab === 'angkatan'
                                ? 'border-b-4 border-green-500 text-green-600 bg-green-50'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                        }`}
                    >
                        <i className="fas fa-graduation-cap mr-2"></i>
                        Analisis Angkatan
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
                        Analisis Siswa
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

            {/* School Analytics Tab */}
            {activeTab === 'school' && !loading && (
                <div>
                    <FormSection title="Filter Data Sekolah" icon="filter" variant="info">
                        <div className="flex gap-4 items-end">
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    <i className="fas fa-book mr-2 text-blue-500"></i>
                                    Mata Pelajaran
                                </label>
                                <select
                                    value={selectedMapelSchool}
                                    onChange={(e) => setSelectedMapelSchool(e.target.value)}
                                    className="input-field w-full"
                                >
                                    <option value="all">Semua Mata Pelajaran</option>
                                    {mataPelajaranList.map((mapel) => (
                                        <option key={mapel.id} value={mapel.id}>{mapel.nama}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    <i className="fas fa-calendar-alt mr-2 text-blue-500"></i>
                                    Rentang Tahun Ajaran
                                </label>
                                <select
                                    value={yearRange}
                                    onChange={(e) => setYearRange(parseInt(e.target.value))}
                                    className="input-field w-full"
                                >
                                    {[1,2,3,4,5,6,7].map(n => (
                                        <option key={n} value={n} disabled={distinctYears.length > 0 && n > distinctYears.length}>{n} Tahun</option>
                                    ))}
                                </select>
                                <p className="text-xs text-gray-500 mt-1">Pilih rentang tahun ajaran terakhir (maks 7)</p>
                            </div>

                            <button
                                onClick={loadSchoolAnalytics}
                                disabled={loading}
                                className="btn-primary"
                            >
                                <i className="fas fa-sync-alt mr-2"></i>
                                Refresh Data
                            </button>
                        </div>
                    </FormSection>

                    {schoolData.length > 0 ? (
                        <>
                            <div className="mb-6">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-semibold text-gray-800">
                                        <i className="fas fa-chart-line text-blue-500 mr-2"></i>
                                        Grafik Trend Nilai Sekolah
                                    </h3>
                                    {selectedMapelSchool && selectedMapelSchool !== 'all' && (
                                        <button
                                            onClick={() => {
                                                const mapelName = mataPelajaranList.find(m => m.id === parseInt(selectedMapelSchool))?.nama || 'Mata Pelajaran';
                                                const filteredData = schoolData.filter(item => parseInt(item.id_mapel) === parseInt(selectedMapelSchool));
                                                exportChartToPDF(
                                                    schoolChartRef,
                                                    `laporan_sekolah_${mapelName}`,
                                                    `Laporan Analitik Sekolah - ${mapelName}`,
                                                    filteredData,
                                                    'school'
                                                );
                                            }}
                                            className="btn-primary"
                                        >
                                            <i className="fas fa-file-pdf mr-2"></i>
                                            Export PDF
                                        </button>
                                    )}
                                </div>
                                
                                <div ref={schoolChartRef} className="bg-white p-6 rounded-xl border-2 border-gray-200 shadow-sm">
                                    {prepareChartData(schoolData).length > 0 ? (
                                        <>
                                            <div className="mb-4 p-4 bg-blue-50 border-l-4 border-blue-500 rounded">
                                                <p className="text-sm text-gray-700">
                                                    Menampilkan trend rata-rata sekolah untuk:{' '}
                                                    <span className="font-bold text-blue-700">
                                                        {selectedMapelSchool === 'all' 
                                                            ? 'Semua Mata Pelajaran' 
                                                            : mataPelajaranList.find(m => m.id === parseInt(selectedMapelSchool))?.nama}
                                                    </span>
                                                </p>
                                            </div>
                                            <ResponsiveContainer width="100%" height={400}>
                                                <BarChart data={prepareChartData(filteredSchoolData)}>
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
                                                    <Bar
                                                        dataKey="nilai"
                                                        fill="#3b82f6"
                                                        label={{ position: 'top', formatter: (value) => value.toFixed(1) }}
                                                    />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </>
                                    ) : (
                                        <EmptyState
                                            icon="chart-bar"
                                            title="Tidak Ada Data Grafik"
                                            description="Belum ada data untuk ditampilkan dalam grafik."
                                        />
                                    )}
                                </div>
                            </div>

                            {/* Data Table */}
                            {(() => {
                                const rows = filteredSchoolData.filter(item => selectedMapelSchool === 'all' || parseInt(item.id_mapel) === parseInt(selectedMapelSchool));
                                const grouped = groupByYearAndSemester(rows);
                                const keys = Object.keys(grouped).sort((a, b) => {
                                    const aInfo = grouped[a];
                                    const bInfo = grouped[b];
                                    const aYear = parseStartYear(aInfo.tahun_ajaran);
                                    const bYear = parseStartYear(bInfo.tahun_ajaran);
                                    if (aYear !== bYear) return bYear - aYear; // Descending year
                                    // Same year, sort by semester (Ganjil before Genap)
                                    if (aInfo.semester === 'Ganjil' && bInfo.semester === 'Genap') return -1;
                                    if (aInfo.semester === 'Genap' && bInfo.semester === 'Ganjil') return 1;
                                    return 0;
                                });
                                
                                if (keys.length === 0) {
                                    return (
                                        <EmptyState
                                            icon="school"
                                            title="Tidak Ada Data Grafik"
                                            description="Belum ada data untuk ditampilkan dalam tabel yang dipilih."
                                        />
                                    );
                                }

                                return keys.map(key => {
                                    const groupInfo = grouped[key];
                                    const groupData = groupInfo.data;
                                    
                                    return (
                                        <div key={key} className="mb-4">
                                            <h4 className="font-semibold text-gray-800 mb-2">
                                                {groupInfo.tahun_ajaran} - Semester {groupInfo.semester} ({groupData.length} Mapel)
                                            </h4>
                                            <div className="overflow-x-auto bg-white rounded-xl border-2 border-gray-200 shadow-sm">
                                                <table className="min-w-full">
                                                    <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                                                        <tr>
                                                            <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 border-b-2">Mata Pelajaran</th>
                                                            <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700 border-b-2">Rata-rata</th>
                                                            <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700 border-b-2">Jumlah Siswa</th>
                                                            <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700 border-b-2">Terendah</th>
                                                            <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700 border-b-2">Tertinggi</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-200">
                                                        {groupData.map((item, idx) => (
                                                            <tr key={`${key}-${idx}`} className="hover:bg-gray-50 transition-colors">
                                                                <td className="px-6 py-4 text-sm text-gray-900">{item.nama_mapel || '-'}</td>
                                                                <td className="px-6 py-4 text-center text-sm font-bold text-blue-600">{item.rata_rata_sekolah || '-'}</td>
                                                                <td className="px-6 py-4 text-center text-sm text-gray-700">{item.jumlah_siswa || '0'}</td>
                                                                <td className="px-6 py-4 text-center text-sm font-semibold text-red-600">{item.nilai_terendah || '-'}</td>
                                                                <td className="px-6 py-4 text-center text-sm font-semibold text-green-600">{item.nilai_tertinggi || '-'}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    );
                                });
                            })()}  
                        </>
                    ) : (
                        <EmptyState
                            icon="school"
                            title="Belum Ada Data Analytics Sekolah"
                            description="Silakan input nilai terlebih dahulu untuk melihat analytics."
                        />
                    )}
                </div>
            )}

            {/* Angkatan Analytics Tab */}
            {activeTab === 'angkatan' && !loading && (
                <div>
                    <FormSection title="Filter Data Angkatan" icon="filter" variant="success">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    <i className="fas fa-graduation-cap mr-2 text-green-500"></i>
                                    Pilih Angkatan
                                </label>
                                <select
                                    value={selectedAngkatan}
                                    onChange={(e) => setSelectedAngkatan(e.target.value)}
                                    className="input-field w-full"
                                >
                                    <option value="">-- Pilih Angkatan --</option>
                                    {angkatanList.map((item, idx) => (
                                        <option key={idx} value={item.angkatan}>
                                            Angkatan {item.angkatan} ({item.jumlah_siswa} siswa)
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    <i className="fas fa-book mr-2 text-green-500"></i>
                                    Mata Pelajaran
                                </label>
                                <select
                                    value={selectedMapelAngkatan}
                                    onChange={(e) => setSelectedMapelAngkatan(e.target.value)}
                                    className="input-field w-full"
                                >
                                    <option value="all">Semua Mata Pelajaran</option>
                                    {mataPelajaranList.map((mapel) => (
                                        <option key={mapel.id} value={mapel.id}>{mapel.nama}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </FormSection>

                    {angkatanData.length > 0 ? (
                        <>
                            <div className="mb-6">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-semibold text-gray-800">
                                        <i className="fas fa-chart-line text-green-500 mr-2"></i>
                                        Grafik Perkembangan Angkatan {selectedAngkatan}
                                    </h3>
                                    {selectedMapelAngkatan && selectedMapelAngkatan !== 'all' && (
                                        <button
                                            onClick={() => {
                                                const mapelName = mataPelajaranList.find(m => m.id === parseInt(selectedMapelAngkatan))?.nama || 'Mata Pelajaran';
                                                const filteredData = angkatanData.filter(item => parseInt(item.id_mapel) === parseInt(selectedMapelAngkatan));
                                                exportChartToPDF(
                                                    angkatanChartRef,
                                                    `laporan_angkatan_${selectedAngkatan}_${mapelName}`,
                                                    `Laporan Analitik Angkatan ${selectedAngkatan} - ${mapelName}`,
                                                    filteredData,
                                                    'angkatan'
                                                );
                                            }}
                                            className="btn-success"
                                        >
                                            <i className="fas fa-file-pdf mr-2"></i>
                                            Export PDF
                                        </button>
                                    )}
                                </div>
                                
                                <div ref={angkatanChartRef} className="bg-white p-6 rounded-xl border-2 border-gray-200 shadow-sm">
                                    {prepareChartData(angkatanData).length > 0 ? (
                                        <>
                                            <div className="mb-4 p-4 bg-green-50 border-l-4 border-green-500 rounded">
                                                <p className="text-sm text-gray-700">
                                                    Menampilkan perkembangan angkatan {selectedAngkatan} untuk:{' '}
                                                    <span className="font-bold text-green-700">
                                                        {selectedMapelAngkatan === 'all' 
                                                            ? 'Semua Mata Pelajaran' 
                                                            : mataPelajaranList.find(m => m.id === parseInt(selectedMapelAngkatan))?.nama}
                                                    </span>
                                                </p>
                                            </div>
                                            <ResponsiveContainer width="100%" height={400}>
                                                <BarChart data={prepareChartData(angkatanData)}>
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
                                                    <Bar
                                                        dataKey="nilai"
                                                        fill="#10b981"
                                                        label={{ position: 'top', formatter: (value) => value.toFixed(1) }}
                                                    />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </>
                                    ) : (
                                        <EmptyState
                                            icon="chart-bar"
                                            title="Tidak Ada Data Grafik"
                                            description="Belum ada data untuk ditampilkan dalam grafik."
                                        />
                                    )}
                                </div>
                            </div>

                            {/* Data Table */}
                            {(() => {
                                const rows = (selectedMapelAngkatan === 'all') ? angkatanData : angkatanData.filter(item => parseInt(item.id_mapel) === parseInt(selectedMapelAngkatan));
                                const grouped = groupByYearAndSemester(rows);
                                const keys = Object.keys(grouped).sort((a, b) => {
                                    const aInfo = grouped[a];
                                    const bInfo = grouped[b];
                                    const aYear = parseStartYear(aInfo.tahun_ajaran);
                                    const bYear = parseStartYear(bInfo.tahun_ajaran);
                                    if (aYear !== bYear) return bYear - aYear; // Descending year
                                    // Same year, sort by semester (Ganjil before Genap)
                                    if (aInfo.semester === 'Ganjil' && bInfo.semester === 'Genap') return -1;
                                    if (aInfo.semester === 'Genap' && bInfo.semester === 'Ganjil') return 1;
                                    return 0;
                                });
                                
                                if (keys.length === 0) return (
                                    <EmptyState icon="graduation-cap" title="Pilih Angkatan untuk Melihat Data" description="Silakan pilih angkatan dari dropdown di atas untuk melihat analytics." />
                                );

                                return keys.map(key => {
                                    const groupInfo = grouped[key];
                                    const groupData = groupInfo.data;
                                    
                                    return (
                                        <div key={key} className="mb-4">
                                            <h4 className="font-semibold text-gray-800 mb-2">
                                                {groupInfo.tahun_ajaran} - Semester {groupInfo.semester} ({groupData.length} Mapel)
                                            </h4>
                                            <div className="overflow-x-auto bg-white rounded-xl border-2 border-gray-200 shadow-sm">
                                                <table className="min-w-full">
                                                    <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                                                        <tr>
                                                            <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 border-b-2">Mata Pelajaran</th>
                                                            <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 border-b-2">Periode</th>
                                                            <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700 border-b-2">Rata-rata Angkatan</th>
                                                            <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700 border-b-2">Jumlah Siswa</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-200">
                                                        {groupData.map((item, idx) => (
                                                            <tr key={`${key}-${idx}`} className="hover:bg-gray-50 transition-colors">
                                                                <td className="px-6 py-4 text-sm text-gray-900">{item.nama_mapel}</td>
                                                                <td className="px-6 py-4 text-sm text-gray-700">{item.tahun_ajaran} {item.semester}</td>
                                                                <td className="px-6 py-4 text-center text-sm font-bold text-green-600">{item.rata_rata_angkatan}</td>
                                                                <td className="px-6 py-4 text-center text-sm text-gray-700">{item.jumlah_siswa}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    );
                                });
                            })()}
                        </>
                    ) : (
                        <EmptyState
                            icon="graduation-cap"
                            title="Pilih Angkatan untuk Melihat Data"
                            description="Silakan pilih angkatan dari dropdown di atas untuk melihat analytics."
                        />
                    )}
                </div>
            )}

            {/* Student Analytics Tab */}
            {activeTab === 'student' && !loading && (
                <div>
                    <FormSection title="Cari Data Siswa" icon="search" variant="warning">
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    <i className="fas fa-id-card mr-2 text-purple-500"></i>
                                    ID Siswa
                                </label>
                                <input
                                    type="number"
                                    placeholder="Contoh: 1001"
                                    value={studentId}
                                    onChange={(e) => setStudentId(e.target.value)}
                                    className="input-field w-full"
                                />
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
                                    {mataPelajaranList.map((mapel) => (
                                        <option key={mapel.id} value={mapel.id}>{mapel.nama}</option>
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
                                    Lihat Data
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
                                    <div className="mb-6">
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="text-lg font-semibold text-gray-800">
                                                <i className="fas fa-chart-line text-purple-500 mr-2"></i>
                                                Grafik Perkembangan Nilai
                                            </h3>
                                            {studentData.data && studentData.data.length > 0 && (
                                                <button
                                                    onClick={() => {
                                                        const mapelName = selectedMapelStudent && selectedMapelStudent !== 'all' 
                                                            ? mataPelajaranList.find(m => m.id === parseInt(selectedMapelStudent))?.nama || 'Mata Pelajaran'
                                                            : 'Semua Mapel';
                                                        exportChartToPDF(
                                                            studentChartRef,
                                                            `laporan_${studentData.student.nama_siswa}_${mapelName}`,
                                                            `Laporan Nilai ${mapelName} - ${studentData.student.nama_siswa}`,
                                                            studentData.data,
                                                            'student',
                                                            { id: studentData.student.id_siswa, nama: studentData.student.nama_siswa }
                                                        );
                                                    }}
                                                    className="btn-primary"
                                                >
                                                    <i className="fas fa-file-pdf mr-2"></i>
                                                    Export PDF
                                                </button>
                                            )}
                                        </div>
                                        
                                        <div ref={studentChartRef} className="bg-white p-6 rounded-xl border-2 border-gray-200 shadow-sm">
                                            {(() => {
                                                let chartData = [];
                                                if (selectedMapelStudent === 'all') {
                                                    chartData = prepareChartData(studentData.data);
                                                } else {
                                                    const filtered = studentData.data.filter(it => parseInt(it.id_mapel) === parseInt(selectedMapelStudent));
                                                    chartData = filtered.map(item => ({
                                                        period: `${item.tahun_ajaran} ${item.semester}`,
                                                        tahun_ajaran: item.tahun_ajaran,
                                                        semester: item.semester,
                                                        nilai: parseFloat(item.rata_keseluruhan || 0)
                                                    })).sort((a, b) => {
                                                        if (a.tahun_ajaran !== b.tahun_ajaran) {
                                                            return a.tahun_ajaran.localeCompare(b.tahun_ajaran);
                                                        }
                                                        return a.semester === 'Ganjil' ? -1 : 1;
                                                    });
                                                }

                                                if (chartData.length === 0) {
                                                    return (
                                                        <EmptyState
                                                            icon="chart-bar"
                                                            title="Tidak Ada Data Grafik"
                                                            description="Belum ada data untuk ditampilkan dalam grafik."
                                                        />
                                                    );
                                                }

                                                return (
                                                    <>
                                                        <div className="mb-4 p-4 bg-purple-50 border-l-4 border-purple-500 rounded">
                                                            <p className="text-sm text-gray-700">
                                                                Progress untuk:{' '}
                                                                <span className="font-bold text-purple-700">
                                                                    {selectedMapelStudent === 'all' 
                                                                        ? 'Semua Mata Pelajaran' 
                                                                        : mataPelajaranList.find(m => m.id === parseInt(selectedMapelStudent))?.nama}
                                                                </span>
                                                            </p>
                                                        </div>
                                                        <ResponsiveContainer width="100%" height={400}>
                                                            <BarChart data={chartData}>
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
                                                                    label={{ value: 'Nilai', angle: -90, position: 'insideLeft' }}
                                                                />
                                                                <Tooltip />
                                                                <Legend />
                                                                <Bar
                                                                    dataKey="nilai"
                                                                    fill="#8b5cf6"
                                                                    label={{ position: 'top', formatter: (value) => value.toFixed(1) }}
                                                                />
                                                            </BarChart>
                                                        </ResponsiveContainer>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </div>

                                    {/* Data Table - Grouped by Class and Semester */}
                                    <div className="space-y-8">
                                        {(() => {
                                            const filteredData = selectedMapelStudent === 'all' 
                                                ? studentData.data 
                                                : studentData.data.filter(item => parseInt(item.id_mapel) === parseInt(selectedMapelStudent));
                                            
                                            const groupedData = groupStudentDataByClassSemester(filteredData);
                                            const groupKeys = Object.keys(groupedData);

                                            if (groupKeys.length === 0) {
                                                return (
                                                    <EmptyState
                                                        icon="clipboard-list"
                                                        title="Tidak Ada Data Nilai"
                                                        description="Tidak ada data nilai yang sesuai dengan filter mata pelajaran."
                                                    />
                                                );
                                            }

                                            return groupKeys.map((groupKey, groupIdx) => {
                                                const groupInfo = groupedData[groupKey];
                                                const groupItems = groupInfo.data;

                                                // Calculate group statistics
                                                const groupNilai = groupItems.map(item => parseFloat(item.rata_keseluruhan || 0)).filter(v => v > 0);
                                                const groupAvg = groupNilai.length > 0 
                                                    ? (groupNilai.reduce((a, b) => a + b, 0) / groupNilai.length).toFixed(2)
                                                    : '-';

                                                return (
                                                    <div key={groupIdx} className="border-2 border-purple-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                                        {/* Group Header */}
                                                        <div className="bg-gradient-to-r from-purple-500 to-indigo-600 px-6 py-4">
                                                            <div className="flex items-center justify-between">
                                                                <div>
                                                                    <h4 className="text-lg font-bold text-white">
                                                                        <i className="fas fa-graduation-cap mr-2"></i>
                                                                        {groupKey}
                                                                    </h4>
                                                                    <p className="text-sm text-purple-100 mt-1">
                                                                        Tahun Ajaran: {groupInfo.period} | {groupItems.length} Mapel
                                                                    </p>
                                                                </div>
                                                                <div className="bg-white bg-opacity-20 px-4 py-2 rounded-lg" title="Rata-rata nilai per mata pelajaran pada periode ini">
                                                                    <p className="text-xs text-purple-100 font-medium">Rata-rata Mapel</p>
                                                                    <p className="text-2xl font-bold text-white">{groupAvg}</p>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Group Table */}
                                                        <div className="overflow-x-auto">
                                                            <table className="min-w-full">
                                                                <thead className="bg-gray-50">
                                                                    <tr>
                                                                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 border-b">Mata Pelajaran</th>
                                                                        <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700 border-b">Rata TP</th>
                                                                        <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700 border-b">UAS</th>
                                                                        <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700 border-b">Nilai Akhir</th>
                                                                        <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700 border-b">Aksi</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-gray-200">
                                                                    {groupItems.map((item, idx) => (
                                                                        <tr key={idx} className="hover:bg-purple-50 transition-colors">
                                                                            <td className="px-6 py-4 text-sm text-gray-900 font-medium">{item.nama_mapel || '-'}</td>
                                                                            <td className="px-6 py-4 text-center text-sm text-gray-700">{item.rata_tp || '-'}</td>
                                                                            <td className="px-6 py-4 text-center text-sm text-gray-700">{item.nilai_uas || '-'}</td>
                                                                            <td className="px-6 py-4 text-center text-sm font-bold text-purple-600">{item.rata_keseluruhan || '-'}</td>
                                                                            <td className="px-6 py-4 text-center text-sm">
                                                                                <button
                                                                                    onClick={() => handleShowMapelDetails(item)}
                                                                                    className="btn-ghost px-3 py-1 border rounded"
                                                                                >
                                                                                    Lihat Detail
                                                                                </button>
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>
                                                );
                                            });
                                        })()}
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
            {/* Detail Modal */}
            {detailModalOpen && (
                <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
                    <div className="modal-content animate-slideInUp w-full max-w-full sm:max-w-3xl md:max-w-4xl lg:max-w-5xl mx-auto max-h-[90vh] overflow-auto bg-white rounded-lg shadow-lg">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 p-4 border-b">
                            <h3 className="text-lg sm:text-xl font-bold">Detail Nilai: {detailModalMapelName}</h3>
                            <div className="ml-auto flex items-center gap-2">
                                <button onClick={handleCloseDetailModal} className="text-gray-500 hover:text-gray-800 p-2 rounded-md">
                                    <i className="fas fa-times"></i>
                                </button>
                            </div>
                        </div>

                        {detailModalLoading ? (
                            <div className="p-6"><LoadingSpinner text="Memuat detail..." /></div>
                        ) : (
                            <div className="p-4">
                                {detailModalData && detailModalData.length > 0 ? (
                                    <div className="overflow-auto bg-white rounded-lg border p-2">
                                        <div className="min-w-[680px]">
                                            <table className="w-full table-auto">
                                                <thead className="bg-gray-50">
                                                    <tr>
                                                        <th className="px-3 py-2 text-left text-xs">Periode</th>
                                                        <th className="px-3 py-2 text-left text-xs">Kelas</th>
                                                        <th className="px-3 py-2 text-center text-xs">Jenis</th>
                                                        <th className="px-3 py-2 text-center text-xs">TP</th>
                                                        <th className="px-3 py-2 text-left text-xs">Nama TP</th>
                                                        <th className="px-3 py-2 text-center text-xs">Nilai</th>
                                                        <th className="px-3 py-2 text-center text-xs">Tanggal</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(() => {
                                                        const nums = detailModalData.map(d => (typeof d.nilai === 'number' ? d.nilai : parseFloat(d.nilai))).filter(n => !isNaN(n));
                                                        const min = nums.length ? Math.min(...nums) : null;
                                                        const max = nums.length ? Math.max(...nums) : null;
                                                        return detailModalData.map((d, idx) => {
                                                            const nVal = typeof d.nilai === 'number' ? d.nilai : parseFloat(d.nilai);
                                                            const highlightLow = min !== null && nVal === min;
                                                            const highlightHigh = max !== null && nVal === max;
                                                            return (
                                                                <tr key={idx} className={`hover:bg-gray-50 ${highlightLow ? 'bg-red-50' : ''} ${highlightHigh ? 'bg-green-50' : ''}`}>
                                                                    <td className="px-3 py-2 text-sm">{d.tahun_ajaran || '-'} {d.semester || ''}</td>
                                                                    <td className="px-3 py-2 text-sm">{d.nama_kelas || '-'}</td>
                                                                    <td className="px-3 py-2 text-center text-sm">{d.jenis_nilai || '-'}</td>
                                                                    <td className="px-3 py-2 text-center text-sm">{d.urutan_tp ? `TP${d.urutan_tp}` : '-'}</td>
                                                                    <td className="px-3 py-2 text-sm">{d.tp_name || '-'}</td>
                                                                    <td className="px-3 py-2 text-center text-sm font-semibold">{d.nilai !== null && d.nilai !== undefined ? d.nilai : '-'}</td>
                                                                    <td className="px-3 py-2 text-center text-sm">{d.tanggal_input ? new Date(d.tanggal_input).toLocaleDateString('en-GB') : '-'}</td>
                                                                </tr>
                                                            );
                                                        });
                                                    })()}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ) : (
                                    <EmptyState icon="clipboard-list" title="Tidak Ada Data" description="Tidak ditemukan nilai untuk mapel ini." />
                                )}
                            </div>
                        )}

                        <div className="p-4 border-t flex justify-end">
                            <button onClick={handleCloseDetailModal} className="btn-ghost px-4 py-2">Tutup</button>
                        </div>
                    </div>
                </div>
            )}
        </ModuleContainer>
    );
};

export default AdminAnalytics;
