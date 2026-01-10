// frontend/src/features/guru/rekapNilai.js
import React, { useState, useEffect } from 'react';
import * as guruApi from '../../api/guru';
import Button from '../../components/Button';
import Table from '../../components/Table';
import ModuleContainer from '../../components/ModuleContainer';
import PageHeader from '../../components/PageHeader';
import FormSection from '../../components/FormSection';
import LoadingSpinner from '../../components/LoadingSpinner';
import StatusMessage from '../../components/StatusMessage';
import EmptyState from '../../components/EmptyState';

const RekapNilai = ({ activeTASemester, userId }) => {
  const [assignments, setAssignments] = useState([]);
  const [selectedAssignment, setSelectedAssignment] = useState('');
  const [rekapNilai, setRekapNilai] = useState([]);
  const [allTpColumns, setAllTpColumns] = useState([]); // TP dari ATP
  const [loading, setLoading] = useState(true);
  const [loadingRekap, setLoadingRekap] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [kkmSettings, setKkmSettings] = useState({}); // KKM values loaded from DB for this assignment

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!userId || !activeTASemester) {
        setError("Informasi guru atau tahun ajaran aktif tidak tersedia.");
        return;
      }
      const assignmentsData = await guruApi.getGuruAssignments(userId, activeTASemester.id_ta_semester);
      setAssignments(assignmentsData);

      if (assignmentsData.length > 0 && !selectedAssignment) {
        setSelectedAssignment(`${assignmentsData[0].id_kelas}-${assignmentsData[0].id_mapel}`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTASemester, userId]);

  useEffect(() => {
    const fetchRekap = async () => {
      if (selectedAssignment && activeTASemester && userId) {
        setLoadingRekap(true);
        const [kelasId, mapelId] = selectedAssignment.split('-').map(Number);
        try {
          // Load TP dari ATP dulu
          await loadTpFromAtp(mapelId, kelasId);
          
          // Load KKM settings dari database dan store ke state
          try {
            const kkmResp = await guruApi.getKkmSettings(userId, mapelId, kelasId, activeTASemester.id_ta_semester);
            if (kkmResp && kkmResp.success && kkmResp.data) {
              setKkmSettings(kkmResp.data);
            } else {
              setKkmSettings({});
            }
          } catch (err) {
            console.warn('Error fetching KKM settings:', err?.message || err);
            setKkmSettings({});
          }
          
          // Kemudian load nilai
          const data = await guruApi.getRekapNilai(userId, mapelId, kelasId, activeTASemester.id_ta_semester);
          setRekapNilai(data || []);
        } catch (err) {
          console.error('Error fetching rekap:', err);
          setError(err.message);
          setRekapNilai([]);
        } finally {
          setLoadingRekap(false);
        }
      } else {
        setRekapNilai([]);
        setAllTpColumns([]);
        setKkmSettings({});
        setLoadingRekap(false);
      }
    };
    
    fetchRekap();
  }, [selectedAssignment, activeTASemester, userId]);

  const loadTpFromAtp = async (mapelId, kelasId) => {
    try {
      const currentAssignment = assignments.find(
        assign => `${assign.id_kelas}-${assign.id_mapel}` === selectedAssignment
      );

      if (!currentAssignment) {
        return;
      }

      let fase = 'A';
      const kelasName = currentAssignment?.nama_kelas || '';
      const tingkatKelas = parseInt(kelasName.match(/^(\d+)/)?.[1] || '1');
      
      if (tingkatKelas >= 1 && tingkatKelas <= 2) fase = 'A';
      else if (tingkatKelas >= 3 && tingkatKelas <= 4) fase = 'B';
      else if (tingkatKelas >= 5 && tingkatKelas <= 6) fase = 'C';

      let semesterNumber = null;
      if (activeTASemester && activeTASemester.semester) {
        semesterNumber = activeTASemester.semester.toLowerCase() === 'ganjil' ? 1 : 2;
      }

      const tpData = await guruApi.getTpByMapelFaseKelas(mapelId, fase, kelasId, semesterNumber);
      
      let tpNumbers = [];
      
      if (tpData.success && tpData.tp_list && tpData.tp_list.length > 0) {
        tpNumbers = tpData.tp_list.map((_, index) => index + 1);
      }
      
      // Load TP manual dari database
      const [kelasId, mapelId] = selectedAssignment.split('-').map(Number);
      const penugasanData = await guruApi.getPenugasanByGuruMapelKelas(
        userId,
        mapelId,
        kelasId,
        activeTASemester.id_ta_semester
      );
      
      if (penugasanData && penugasanData.id_penugasan) {
        const manualTpData = await guruApi.getManualTp(
          penugasanData.id_penugasan,
          activeTASemester.id_ta_semester
        );
        
        if (manualTpData.success && manualTpData.manual_tp.length > 0) {
          const manualTpColumns = manualTpData.manual_tp.map(tp => tp.tp_number);
          // Gabungkan dengan TP dari ATP, hilangkan duplikat
          const allTp = [...new Set([...tpNumbers, ...manualTpColumns])].sort((a, b) => a - b);
          tpNumbers = allTp;
        }
      }
      
      setAllTpColumns(tpNumbers.length > 0 ? tpNumbers : []);
    } catch (err) {
      console.log('Error loading TP from ATP:', err.message);
      setAllTpColumns([]);
    }
  };

  if (loading) return <LoadingSpinner message="Memuat data rekap nilai..." />;
  if (error) return <StatusMessage type="error" message={error} />;

  const currentAssignment = assignments.find(
    assign => `${assign.id_kelas}-${assign.id_mapel}` === selectedAssignment
  );

  // Mengolah data rekap untuk tampilan tabel pivot
  const processedRekap = {};
  const gradeTypes = new Set();
  
  // Tambahkan semua TP dari ATP ke gradeTypes (supaya kolom muncul meski belum ada nilai)
  if (allTpColumns.length > 0) {
    allTpColumns.forEach(tpNum => {
      gradeTypes.add(`TP${tpNum}`);
    });
  }
  
  // Tambahkan UAS
  gradeTypes.add('UAS');
  
  // Process nilai yang ada
  if (Array.isArray(rekapNilai) && rekapNilai.length > 0) {
    rekapNilai.forEach(item => {
      if (!item || !item.id_siswa) return; // Skip invalid data
      
      // Use id_siswa as key instead of nama_siswa (more reliable)
      if (!processedRekap[item.id_siswa]) {
        processedRekap[item.id_siswa] = { 
          id_siswa: item.id_siswa, 
          nama_siswa: item.nama_siswa 
        };
      }
      
      // Create column name based on jenis_nilai and urutan_tp
      let columnName;
      if (item.jenis_nilai === 'TP') {
        columnName = `TP${item.urutan_tp}`;
      } else if (item.jenis_nilai === 'UAS') {
        columnName = 'UAS';
      } else {
        columnName = item.jenis_nilai; // fallback
      }
      
      processedRekap[item.id_siswa][columnName] = item.nilai;
      gradeTypes.add(columnName); // Tetap add untuk handle TP manual yang belum di ATP
    });
  }

  const uniqueGradeTypes = Array.from(gradeTypes).sort((a, b) => {
    // Custom sort: TP1, TP2, TP3, ..., UAS
    if (a.startsWith('TP') && b.startsWith('TP')) {
      const numA = parseInt(a.substring(2));
      const numB = parseInt(b.substring(2));
      return numA - numB;
    } else if (a.startsWith('TP') && b === 'UAS') {
      return -1; // TP comes before UAS
    } else if (a === 'UAS' && b.startsWith('TP')) {
      return 1; // UAS comes after TP
    }
    return a.localeCompare(b);
  });
  const rekapTableData = Object.values(processedRekap);

  // Prepare columns for Table component
  const columns = [
    {
      key: 'nama_siswa',
      label: 'Nama Siswa',
      className: 'font-medium text-gray-900',
    },
    ...uniqueGradeTypes.map(tipe => ({
      key: tipe,
      // Show KKM value in header if available
      label: tipe + (tipe.startsWith('TP') ? ` (KKM ${ (Number(kkmSettings[tipe] || kkmSettings[`TP${tipe.replace('TP','')}`]) || (tipe.startsWith('TP') ? 75 : '')) })` : (tipe === 'UAS' ? ` (KKM ${ (Number(kkmSettings.UAS) || 75) })` : '')),
      className: 'text-center',
      render: (nilai, row) => {
        // Determine KKM threshold for this column
        let kkmVal = 75;
        if (tipe.startsWith('TP')) {
          const tpNum = parseInt(tipe.substring(2));
          const v = kkmSettings && (kkmSettings[`TP${tpNum}`] !== undefined) ? Number(kkmSettings[`TP${tpNum}`]) : NaN;
          kkmVal = !isNaN(v) ? v : 75;
        } else if (tipe === 'UAS') {
          const v = kkmSettings && (kkmSettings.UAS !== undefined) ? Number(kkmSettings.UAS) : NaN;
          kkmVal = !isNaN(v) ? v : 75;
        }
        const yellowThreshold = Math.max(0, kkmVal - 15);

        return (
          <span className={`inline-flex items-center justify-center w-16 px-2 py-1 rounded ${
            typeof nilai === 'number' 
              ? (nilai >= kkmVal
                  ? 'bg-green-100 text-green-800 font-semibold'
                  : (nilai >= yellowThreshold ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800 font-semibold'))
              : 'text-gray-400'
          }`}>
            {typeof nilai === 'number' ? nilai : '-'}
          </span>
        );
      },
    })),
    {
      key: 'nilai_akhir',
      label: 'Nilai Akhir',
      className: 'text-center font-semibold',
      render: (value, row) => {
        // Table passes (value, row) - we need row object
        // Calculate TP average with safe access
        const tpGrades = uniqueGradeTypes
          .filter(tipe => tipe.startsWith('TP'))
          .map(tipe => row?.[tipe]) // Safe access
          .filter(n => typeof n === 'number');
        const tpAverage = tpGrades.length > 0 ? tpGrades.reduce((sum, n) => sum + n, 0) / tpGrades.length : 0;
        
        // Get UAS value with safe access
        const uasValue = row?.['UAS'];
        
        // Calculate final grade (70% TP + 30% UAS)
        let finalGrade = '-';
        if (tpGrades.length > 0 && typeof uasValue === 'number') {
          finalGrade = (tpAverage * 0.7 + uasValue * 0.3).toFixed(2);
        }
        
        // Determine final KKM
        const finalKkm = (kkmSettings && kkmSettings.FINAL !== undefined && !isNaN(Number(kkmSettings.FINAL))) ? Number(kkmSettings.FINAL) : 75;
        const finalYellow = Math.max(0, finalKkm - 15);
        
        return (
          <span className={`inline-flex items-center justify-center w-20 px-3 py-1 rounded-full font-bold ${
            finalGrade !== '-'
              ? (parseFloat(finalGrade) >= finalKkm 
                  ? 'bg-green-500 text-white'
                  : (parseFloat(finalGrade) >= finalYellow ? 'bg-yellow-500 text-white' : 'bg-red-500 text-white'))
              : 'text-gray-400'
          }`}>
            {finalGrade}
          </span>
        );
      },
    },
  ];

  return (
    <ModuleContainer>
      <PageHeader
        icon="clipboard-list"
        title="Rekap Nilai Siswa"
        subtitle={activeTASemester ? `${activeTASemester.tahun_ajaran} - ${activeTASemester.semester}` : 'Belum ada tahun ajaran aktif'}
        badge={currentAssignment ? `${currentAssignment.nama_kelas} - ${currentAssignment.nama_mapel}` : null}
      />

      {message && <StatusMessage type={messageType} message={message} />}

      {!activeTASemester && (
        <StatusMessage
          type="warning"
          message="Tahun Ajaran & Semester aktif belum diatur. Harap hubungi Admin."
        />
      )}

      {assignments.length > 0 ? (
        <>
          <FormSection title="Pilih Kelas dan Mata Pelajaran">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Kelas dan Mata Pelajaran
                </label>
                <select
                  value={selectedAssignment}
                  onChange={(e) => setSelectedAssignment(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors bg-white"
                >
                  {assignments.map(assign => (
                    <option key={`${assign.id_kelas}-${assign.id_mapel}`} value={`${assign.id_kelas}-${assign.id_mapel}`}>
                      {assign.nama_kelas} - {assign.nama_mapel}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </FormSection>

          {currentAssignment && (
            <div className="card-body">
              <div className="mb-4 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-200">
                <h3 className="text-lg font-semibold text-indigo-900 mb-2">
                  <i className="fas fa-chart-line mr-2"></i>
                  Rekap Nilai {currentAssignment.nama_mapel} di Kelas {currentAssignment.nama_kelas}
                </h3>
                <p className="text-sm text-gray-600">
                  <i className="fas fa-info-circle mr-1"></i>
                  <strong>Keterangan:</strong> Nilai Akhir = 70% rata-rata TP + 30% UAS
                </p>

                {/* Color legend and KKM note */}
                <div className="mt-3 p-3 bg-white border rounded">
                  <p className="text-sm font-medium text-gray-800 mb-2">Catatan Warna:</p>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-700">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
                      <span>Hijau — Nilai &ge; KKM (nilai KKM di-set oleh guru)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-yellow-400 inline-block" />
                      <span>Kuning — Nilai &ge; (KKM - 15)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
                      <span>Merah — Nilai &lt; (KKM - 15)</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    KKM diambil dari pengaturan guru untuk kombinasi kelas & mata pelajaran ini. Jika belum diset oleh guru, sistem menggunakan nilai default <strong>75</strong> untuk perhitungan warna.
                  </p>
                </div>
              </div>

              {loadingRekap ? (
                <LoadingSpinner text="Memuat rekap nilai..." />
              ) : rekapTableData.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table
                    columns={columns}
                    data={rekapTableData}
                    keyField="id_siswa"
                  />
                </div>
              ) : (
                <EmptyState
                  icon="clipboard-list"
                  title="Belum Ada Nilai"
                  message="Belum ada nilai yang diinput untuk kombinasi kelas dan mata pelajaran ini."
                />
              )}
            </div>
          )}
        </>
      ) : (
        <EmptyState
          icon="chalkboard-teacher"
          title="Belum Ada Penugasan"
          message="Anda belum ditugaskan mengajar mata pelajaran di kelas manapun untuk semester aktif ini. Silakan hubungi Admin."
        />
      )}
    </ModuleContainer>
  );
};

export default RekapNilai;
