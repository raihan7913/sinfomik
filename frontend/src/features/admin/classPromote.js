// frontend/src/features/admin/classPromote.js
import React, { useState, useEffect } from 'react';
import * as adminApi from '../../api/admin';
import Button from '../../components/Button';
import Table from '../../components/Table';
import ModuleContainer from '../../components/ModuleContainer';
import PageHeader from '../../components/PageHeader';
import FormSection from '../../components/FormSection';
import ConfirmDialog from '../../components/ConfirmDialog';
import LoadingSpinner from '../../components/LoadingSpinner';
import StatusMessage from '../../components/StatusMessage';
import EmptyState from '../../components/EmptyState';

const ClassPromote = () => {
  const [taSemesters, setTASemesters] = useState([]);
  const [fromTASemesterId, setFromTASemesterId] = useState('');
  const [toTASemesterId, setToTASemesterId] = useState('');
  const [studentsGroupedByClass, setStudentsGroupedByClass] = useState([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  const fetchInitialData = async () => {
    setLoading(true);
    setError(null);
    try {
      const taData = await adminApi.getTASemester();
      setTASemesters(taData);
      if (taData.length > 0) {
        const currentActive = taData.find(ta => ta.is_aktif);
        setFromTASemesterId(currentActive ? currentActive.id_ta_semester : taData[0].id_ta_semester);
        // Default to next semester or same if only one
        const nextSemester = taData.find(ta => ta.id_ta_semester !== (currentActive ? currentActive.id_ta_semester : taData[0].id_ta_semester));
        setToTASemesterId(nextSemester ? nextSemester.id_ta_semester : (currentActive ? currentActive.id_ta_semester : taData[0].id_ta_semester));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllStudentsInSemester = async () => {
    if (!fromTASemesterId) {
      setStudentsGroupedByClass([]);
      setTotalStudents(0);
      return;
    }
    
    try {
      setLoading(true);
      // Fetch all classes in source semester
      const kelasData = await adminApi.getKelas(fromTASemesterId);
      
      // Fetch students for each class
      const classPromises = kelasData.map(async (kelas) => {
        try {
          const students = await adminApi.getSiswaInKelas(kelas.id_kelas, fromTASemesterId);
          return {
            kelas: kelas,
            students: students,
            count: students.length
          };
        } catch (err) {
          console.error(`Error fetching students for class ${kelas.nama_kelas}:`, err);
          return {
            kelas: kelas,
            students: [],
            count: 0
          };
        }
      });
      
      conAllStudentsInSemester();
  }, [sFrom.length === 0) {
      setFromKelasId('');
    }
  }, [kelasFrom, fromKelasId]);

  useEffect(() => {
    fetchKelasForSemester(toTASemesterId, setKelasTo);
  }, [toTASemesterId]);

  useEffect(() => {
    if (kelasTo.length > 0 && !toKelasId) {
      setToKelasId(kelasTo[0].id_kelas);
    } else if (kelasTo.length === 0) {
      setToKelasId('');
    }
  }, [kelasTo, toKelasId]);

  useEffect(() => {
    fetchStudentsForPromotion();
  }, [fromKelasId, fromTASemesterId]);

  const showMessage = (text, type = 'success') => {
    setMessage(text);
    setMessageType(type);
    
    setTimeout(() => {
      setMessage('');
      setMessageType('');
    }, 5000);
  };

  const handlePromoteClick = () => {
    if (!fromKelasId || !toKelasId || !fromTASemesterId || !toTASemesterId || studentsInFromKelas.length === 0) {
      showMessage('Lengkapi semua pilihan dan pastikan ada siswa di kelas sumber.', 'error');
      return;
    }
    if (fromKelasId === toKelasId && fromTASemesterId === toTASemesterId) {
      showMessage('Kelas sumber dan tujuan tidak boleh sama pada semester yang sama.', 'error');
      return;
    }
    setShowConfirm(true);
  };

  const handlePromoteStudents = async () => {
    const studentIdsToPromote = studentsInFromKelas.map(s => s.id_siswa);
    console.log('🎓 Promoting students:', {
      studentIds: studentIdsToPromote,
      targetClass: toKelasId,
      targetSemester: toTASemesterId,
      totalStudents: studentIdsToPromote.length
    });

    try {
      const response = await adminApi.promoteStudents(studentIdsToPromote, toKelasId, toTASemesterId);
      console.log('✅ Promotion response:', response);
      showMessage(response.message, 'success');
      TASemesterId || !toTASemesterId || totalStudents === 0) {
      showMessage('Lengkapi pilihan semester dan pastikan ada siswa di semester sumber.', 'error');
      return;
    }
    if (fromTASemesterId === toTASemesterId) {
      showMessage('Semester sumber dan tujuan tidak boleh sama.', 'error');
      return;
    }
    setShowConfirm(true);
  };

  const handlePromoteStudents = async () => {
    try {
      leclassColumns = [
    {
      key: 'kelas',
      label: 'Kelas',
      render: (value) => (
        <div className="flex items-center">
          <div className="bg-gradient-to-r from-purple-400 to-indigo-500 p-2 rounded-full mr-3">
            <i className="fas fa-door-open text-white text-sm"></i>
          </div>
          <span className="font-medium">{value.nama_kelas}</span>
        </div>
      )
    },
    {
      key: 'count',
      label: 'Jumlah Siswa',
      render: (value) => (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
          <i className="fas fa-users mr-1"></i>
          {value} siswa
        </span>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: () => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <i className="fas fa-check-circle mr-1"></i>
          Siap dipindahkan
        </span>
      )
    }
  ];

      render: () => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <i cTotal Siswa',
      value: totalStudents,
      icon: 'user-graduate',
      gradient: 'from-blue-400 to-indigo-500'
    },
    {
      label: 'Jumlah Kelas',
      value: studentsGroupedByClass.length,
      icon: 'door-open',
      gradient: 'from-purple-400 to-pink-500'
    },
    {
      label: 'Semester Sumber',
      value: fromSemester?.semester || '-',
      icon: 'arrow-circle-right',
      gradient: 'from-orange-400 to-red-500'
    },
    {
      label: 'Semester Tujuan',
      value: toSemester?.semester || '-',
      icon: 'arrow-circle-left',
      gradient: 'from-emerald-400 to-cyan',
      icon: 'arrow-circle-right',
      gradient: 'from-orange-400 to-red-500'
    },
    {
      label: 'Kelas Tujuan',
      value: toClass?.nama_kelas || '-',
      icon: 'arrow-circle-left',
      gradient: 'from-emerald-400 to-cyan-500'
    },
    {
      label: 'Jumlah Kelas',
      value: taSemesters.length,
      icon: 'calendar-alt',
      gradient: 'from-purple-400 to-pink-500'
    }
  ];

  return (exchange-alt"
        title="Pindah Semester Massal"
        subtitle="Memindahkan semua siswa ke semester berikutnya (kelas tetap sama)"
        badge={`${totalStudents} siswa siap dipindahkan`}
        action={
          <Button
            variant="secondary"
            icon="sync-alt"
            onClick={() => {
              fetchInitialData();
              fetchAllStudentsInSemester
            onClick={() => {
              fetchInitialData();
              fetchStudentsForPromotion();
            }}
            title="Muat Ulang"
          />
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
        {statsData.map((stat, idx) => (
          <div key={idx} className={`bg-gradient-to-r ${stat.gradient} rounded-xl p-4 sm:p-6 text-white`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-xs sm:text-sm">{stat.label}</p>
                <p className="text-xl sm:text-2xl font-bold truncate">{stat.value}</p>
              </div>
              <div className="bg-white/20 p-2 sm:p-3 rounded-full">
                <i className={`fas fa-${stat.icon} text-lg sm:text-2xl`}></i>
              </div>
            </div>
          </div>
        ))}
      </div>

      {message && (
        <StatusMessage 
          type={messageType}
          message={message}
          className="mb-6"
        />
      )}

      {loading && <LoadingSpinner message="Memuat data promosi kelas..." />}

      {error && (
        <StatusMessage 
          type="error"
          message={error}
          icon="exclamation-circle"
        />
      )}

      {!loading && !error && (
        <>
          {/* Info AlFitur ini akan memindahkan SEMUA siswa dari semester yang dipilih ke semester tujuan. Setiap siswa akan tetap berada di kelas yang sama, hanya pindah semester saja."
            icon="info-circle"
            className="mb-8"
          />

          {/* Semester Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 mb-8">
            {/* Source Semester */}
            <FormSection 
              title="Semester Sumber" 
              icon="calendar-alt"
              variant="warning"
            >
              <div className="form-group">
                <label>
                  <i className="fas fa-calendar-check mr-2 text-gray-500"></i>
                  Tahun Ajaran & Semester Sumber
                </label>
                <select 
                  value={fromTASemesterId} 
                  onChange={(e) => setFromTASemesterId(parseInt(e.target.value))}
                >
                  {taSemesters.map(ta => (
                    <option key={ta.id_ta_semester} value={ta.id_ta_semester}>
                      {ta.tahun_ajaran} - {ta.semester}
                    </option>
                  ))}
                </select>
                {fromSemester && (
                  <p className="text-sm text-gray-500 mt-2">
                    <i className="fas fa-info-circle mr-1"></i>
                    Semua siswa di semester ini akan dipindahkan
                  </p>
                )}
              </div>
            </FormSection>

            {/* Destination Semester */}
            <FormSection 
              title="Semester Tujuan" 
              icon="calendar-check"
              variant="success"
            >
              <div className="form-group">
                <label>
                  <i className="fas fa-calendar-plus mr-2 text-gray-500"></i>
                  Tahun Ajaran & Semester Tujuan
                </label>
                <select 
                  value={toTASemesterId} 
                  onChange={(e) => setToTASemesterId(parseInt(e.target.value))}
                >
                  {taSemesters.map(ta => (
                    <option key={ta.id_ta_semester} value={ta.id_ta_semester}>
                      {ta.tahun_ajaran} - {ta.semester}
                    </option>
                  ))}
                </select>
                {toSemester && (
                  <p className="text-sm text-gray-500 mt-2">
                    <i className="fas fa-info-circle mr-1"></i>
                    Siswa akan dipindahkan ke semester ini (kelas tetap sama)
                  </p>
                )}<option key={k.id_kelas} value={k.id_kelas}>{k.nama_kelas}</option>
                    ))}
                  </select>
                </div>
              </div>
            </FormSection>
          </div>

          {/* Students List */}
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
              <h3 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center">
                <i className="fas fa-users mr-3 text-purple-500 text-2xl sm:text-3xl"></i>
                Siswa di Kelas Sumber
                {fromClass && (
                  <span className="ml-3 text-sm bg-purple-100 text-purple-800 px-3 py-1 rounded-full font-medium">
                    {fromClass.nama_kelas}
                  </span>
                )}
              </h3>
              <div className="bg-gradient-to-r from-purple-400 to-pink-400 rounded-xl px-4 py-2 text-white">
                <div className="flex items-center">
                  <i className="fas fa-user-friends mr-2"></i>
                  <span className="font-bold text-lg">{studentsInFromKelas.length}</span>
                    <span className="ml-1 text-sm">Siswa</span>
                </div>
              </div>
            </div>

            {studentsInFromKelas.length > 0 ? (
              Classes List */}
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
              <h3 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center">
                <i className="fas fa-door-open mr-3 text-purple-500 text-2xl sm:text-3xl"></i>
                Kelas di Semester Sumber
                {fromSemester && (
                  <span className="ml-3 text-sm bg-purple-100 text-purple-800 px-3 py-1 rounded-full font-medium">
                    {fromSemester.tahun_ajaran} - {fromSemester.semester}
                  </span>
                )}
              </h3>
              <div className="bg-gradient-to-r from-purple-400 to-pink-400 rounded-xl px-4 py-2 text-white">
                <div className="flex items-center">
                  <i className="fas fa-user-friends mr-2"></i>
                  <span className="font-bold text-lg">{totalStudents}</span>
                  <span className="ml-1 text-sm">Siswa</span>
                </div>
              </div>
            </div>

            {studentsGroupedByClass.length > 0 ? (
              <Table
                columns={classColumns}
                data={studentsGroupedByClass}
              />
            ) : (
              <EmptyState
                icon="inbox"
                title="Tidak ada kelas"
                message="Tidak ada kelas dengan siswa di semester yang dipilih."
              />
            )}
          </div>

          {/* Promotion Summary */}
          {totalStudents > 0 && fromSemester && toSemester && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-200 mb-8">
              <h4 className="font-semibold text-gray-800 mb-4 flex items-center">
                <i className="fas fa-clipboard-check mr-2 text-blue-500"></i>
                Ringkasan Pemindahan Semester
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Dari</p>
                  <p className="font-bold text-orange-600">{fromSemester.tahun_ajaran}</p>
                  <p className="text-lg font-bold text-gray-800">{fromSemester.semester}</p>
                  <p className="text-xs text-gray-500 mt-1">{studentsGroupedByClass.length} kelas</p>
                </div>
                <div className="flex items-center justify-center">
                  <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-3 rounded-full">
                    <i className="fas fa-arrow-right text-white text-2xl"></i>
                  </div>
                </div>
                <div className="bg-white p-4 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Ke</p>
                  <p className="font-bold text-green-600">{toSemester.tahun_ajaran}</p>
                  <p className="text-lg font-bold text-gray-800">{toSemester.semester}</p>
                  <p className="text-xs text-gray-500 mt-1">Kelas tetap sama</p>
                </div>
              </div>
              <div className="mt-4 p-3 bg-blue-100 rounded-lg">
                <p className="text-sm text-blue-800">
                  <i className="fas fa-info-circle mr-2"></i>
                  <strong>{totalStudents} siswa</strong> dari <strong>{studentsGroupedByClass.length} kelas</strong> akan dipindahkan ke semester <strong>{toSemester.semester}</strong> dengan tetap berada di kelas yang sama.
                </pg
          show={showexchange-alt"
              onClick={handlePromoteClick}
              disabled={totalStudents === 0 || fromTASemesterId === toTASemesterId}
              className="px-8 py-4 text-lg"
            >
              Pindahkan {totalStudents} Siswa ke Semester Baru
          onCancel={() => setShowConfirm(false)}
          variant="primary"
        />
      )}
    </ModuleContainer>
  );
};

export default ClassPromote;
emindahan Semester Massal"
          message={`Apakah Anda yakin ingin memindahkan ${totalStudents} siswa dari ${studentsGroupedByClass.length} kelas di semester ${fromSemester?.semester} (${fromSemester?.tahun_ajaran}) ke semester ${toSemester?.semester} (${toSemester?.tahun_ajaran})? Setiap siswa akan tetap berada di kelas yang sama.`}
          confirmText="Pindahkan Semua