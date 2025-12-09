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
  const [fromKelasId, setFromKelasId] = useState('');
  const [toKelasId, setToKelasId] = useState('');
  const [kelasFrom, setKelasFrom] = useState([]);
  const [kelasTo, setKelasTo] = useState([]);
  const [studentsInFromKelas, setStudentsInFromKelas] = useState([]);
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
        setToTASemesterId(currentActive ? currentActive.id_ta_semester : taData[0].id_ta_semester);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchKelasForSemester = async (semesterId, setKelasState) => {
    if (!semesterId) {
      setKelasState([]);
      return;
    }
    try {
      const data = await adminApi.getKelas(semesterId);
      setKelasState(data);
    } catch (err) {
      console.error("Error fetching classes:", err);
      setKelasState([]);
    }
  };

  const fetchStudentsForPromotion = async () => {
    if (fromKelasId && fromTASemesterId) {
      try {
        const data = await adminApi.getSiswaInKelas(fromKelasId, fromTASemesterId);
        setStudentsInFromKelas(data);
      } catch (err) {
        console.error("Error fetching students for promotion:", err);
        setStudentsInFromKelas([]);
      }
    } else {
      setStudentsInFromKelas([]);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchKelasForSemester(fromTASemesterId, setKelasFrom);
  }, [fromTASemesterId]);

  useEffect(() => {
    if (kelasFrom.length > 0 && !fromKelasId) {
      setFromKelasId(kelasFrom[0].id_kelas);
    } else if (kelasFrom.length === 0) {
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
      showMessage('Please complete all selections and ensure there are students in the source class.', 'error');
      return;
    }
    if (fromKelasId === toKelasId && fromTASemesterId === toTASemesterId) {
      showMessage('Source and destination class cannot be the same for the same semester.', 'error');
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
      
      // Wait a moment then refresh data
      setTimeout(() => {
        fetchStudentsForPromotion();
      }, 500);
    } catch (err) {
      console.error('❌ Promotion error:', err);
      showMessage(err.message, 'error');
    } finally {
      setShowConfirm(false);
    }
  };

  const studentColumns = [
    {
      key: 'id_siswa',
      label: 'Student ID',
      render: (value) => <span className="font-medium">{value}</span>
    },
    {
      key: 'nama_siswa',
      label: 'Student Name',
      render: (value) => (
        <div className="flex items-center">
          <div className="bg-gradient-to-r from-blue-400 to-indigo-500 p-2 rounded-full mr-3">
            <i className="fas fa-user text-white text-sm"></i>
          </div>
          <span className="font-medium">{value}</span>
        </div>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: () => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <i className="fas fa-check-circle mr-1"></i>
          Ready to promote
        </span>
      )
    }
  ];

  const fromClass = kelasFrom.find(k => k.id_kelas === fromKelasId);
  const toClass = kelasTo.find(k => k.id_kelas === toKelasId);
  const fromSemester = taSemesters.find(t => t.id_ta_semester === fromTASemesterId);
  const toSemester = taSemesters.find(t => t.id_ta_semester === toTASemesterId);

  const statsData = [
    {
      label: 'Students to Promote',
      value: studentsInFromKelas.length,
      icon: 'user-graduate',
      gradient: 'from-blue-400 to-indigo-500'
    },
    {
      label: 'Source Class',
      value: fromClass?.nama_kelas || '-',
      icon: 'arrow-circle-right',
      gradient: 'from-orange-400 to-red-500'
    },
    {
      label: 'Destination Class',
      value: toClass?.nama_kelas || '-',
      icon: 'arrow-circle-left',
      gradient: 'from-emerald-400 to-cyan-500'
    },
    {
      label: 'Available Classes',
      value: taSemesters.length,
      icon: 'calendar-alt',
      gradient: 'from-purple-400 to-pink-500'
    }
  ];

  return (
    <ModuleContainer>
      <PageHeader
        icon="level-up-alt"
        title="Student Class Promotion"
        subtitle="Promote students to the next grade level efficiently"
        badge={`${studentsInFromKelas.length} students ready`}
        action={
          <Button
            variant="secondary"
            icon="sync-alt"
            onClick={() => {
              fetchInitialData();
              fetchStudentsForPromotion();
            }}
            title="Refresh"
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

      {loading && <LoadingSpinner message="Loading class promotion data..." />}

      {error && (
        <StatusMessage 
          type="error"
          message={error}
          icon="exclamation-circle"
        />
      )}

      {!loading && !error && (
        <>
          {/* Info Alert */}
          <StatusMessage 
            type="info"
            message="Gunakan fitur ini untuk hanya untuk mempromosikan siswa ke kelas yang sama dengan tahun ajaran yang sama namun semester yang berbeda."
            icon="info-circle"
            className="mb-8"
          />

          {/* Promotion Form */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 mb-8">
            {/* Source Class */}
            <FormSection 
              title="From (Source)" 
              icon="arrow-circle-right"
              variant="warning"
            >
              <div className="space-y-4">
                <div className="form-group">
                  <label>
                    <i className="fas fa-calendar-alt mr-2 text-gray-500"></i>
                    Academic Year & Semester
                  </label>
                  <select 
                    value={fromTASemesterId} 
                    onChange={(e) => setFromTASemesterId(parseInt(e.target.value))}
                  >
                    {taSemesters.map(ta => (
                      <option key={ta.id_ta_semester} value={ta.id_ta_semester}>
                        {ta.tahun_ajaran} {ta.semester}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>
                    <i className="fas fa-door-open mr-2 text-gray-500"></i>
                    Source Class
                  </label>
                  <select 
                    value={fromKelasId} 
                    onChange={(e) => setFromKelasId(parseInt(e.target.value))}
                  >
                    {kelasFrom.map(k => (
                      <option key={k.id_kelas} value={k.id_kelas}>{k.nama_kelas}</option>
                    ))}
                  </select>
                </div>
              </div>
            </FormSection>

            {/* Destination Class */}
            <FormSection 
              title="To (Destination)" 
              icon="arrow-circle-left"
              variant="success"
            >
              <div className="space-y-4">
                <div className="form-group">
                  <label>
                    <i className="fas fa-calendar-alt mr-2 text-gray-500"></i>
                    Academic Year & Semester
                  </label>
                  <select 
                    value={toTASemesterId} 
                    onChange={(e) => setToTASemesterId(parseInt(e.target.value))}
                  >
                    {taSemesters.map(ta => (
                      <option key={ta.id_ta_semester} value={ta.id_ta_semester}>
                        {ta.tahun_ajaran} {ta.semester}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>
                    <i className="fas fa-door-open mr-2 text-gray-500"></i>
                    Destination Class
                  </label>
                  <select 
                    value={toKelasId} 
                    onChange={(e) => setToKelasId(parseInt(e.target.value))}
                  >
                    {kelasTo.map(k => (
                      <option key={k.id_kelas} value={k.id_kelas}>{k.nama_kelas}</option>
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
                Students in Source Class
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
                  <span className="ml-1 text-sm">Students</span>
                </div>
              </div>
            </div>

            {studentsInFromKelas.length > 0 ? (
              <Table
                columns={studentColumns}
                data={studentsInFromKelas}
              />
            ) : (
              <EmptyState
                icon="user-slash"
                title="No Students Found"
                message="There are no students in the selected source class."
              />
            )}
          </div>

          {/* Promotion Summary */}
          {studentsInFromKelas.length > 0 && fromClass && toClass && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-200 mb-8">
              <h4 className="font-semibold text-gray-800 mb-4 flex items-center">
                <i className="fas fa-clipboard-check mr-2 text-blue-500"></i>
                Promotion Summary
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">From</p>
                  <p className="font-bold text-orange-600">{fromClass.nama_kelas}</p>
                  <p className="text-xs text-gray-500">{fromSemester?.tahun_ajaran} - {fromSemester?.semester}</p>
                </div>
                <div className="flex items-center justify-center">
                  <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-3 rounded-full">
                    <i className="fas fa-arrow-right text-white text-2xl"></i>
                  </div>
                </div>
                <div className="bg-white p-4 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">To</p>
                  <p className="font-bold text-green-600">{toClass.nama_kelas}</p>
                  <p className="text-xs text-gray-500">{toSemester?.tahun_ajaran} - {toSemester?.semester}</p>
                </div>
              </div>
            </div>
          )}

          {/* Promote Button */}
          <div className="flex justify-center">
            <Button
              variant="primary"
              icon="user-graduate"
              onClick={handlePromoteClick}
              disabled={studentsInFromKelas.length === 0 || !toKelasId}
              className="px-8 py-4 text-lg"
            >
              Promote {studentsInFromKelas.length} Student{studentsInFromKelas.length !== 1 ? 's' : ''}
            </Button>
          </div>
        </>
      )}

      {/* Confirmation Dialog */}
      {showConfirm && (
        <ConfirmDialog
          show={showConfirm}
          title="Confirm Student Promotion"
          message={`Are you sure you want to promote ${studentsInFromKelas.length} student${studentsInFromKelas.length !== 1 ? 's' : ''} from ${fromClass?.nama_kelas} (${fromSemester?.tahun_ajaran} - ${fromSemester?.semester}) to ${toClass?.nama_kelas} (${toSemester?.tahun_ajaran} - ${toSemester?.semester})? This action will move all students to the new class.`}
          confirmText="Promote Students"
          cancelText="Cancel"
          onConfirm={handlePromoteStudents}
          onCancel={() => setShowConfirm(false)}
          variant="primary"
        />
      )}
    </ModuleContainer>
  );
};

export default ClassPromote;
