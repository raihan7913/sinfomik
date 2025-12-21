// frontend/src/features/admin/studentClassEnroll.js
import React, { useState, useEffect, useRef } from 'react';
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

const StudentClassEnroll = ({ activeTASemester }) => {
  const [students, setStudents] = useState([]);
  const [kelas, setKelas] = useState([]);
  const [selectedKelasId, setSelectedKelasId] = useState('');
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [studentsInSelectedKelas, setStudentsInSelectedKelas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, student: null });
  const [isImporting, setIsImporting] = useState(false);
  const [importErrors, setImportErrors] = useState([]);
  const [waitingForFile, setWaitingForFile] = useState(false);
  const [enrolledPageCurrent, setEnrolledPageCurrent] = useState(1);
  const [availablePageCurrent, setAvailablePageCurrent] = useState(1);
  const itemsPerPage = 20;

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [studentsData, kelasData] = await Promise.all([
        adminApi.getStudents(),
        activeTASemester ? adminApi.getKelas(activeTASemester.id_ta_semester) : Promise.resolve([])
      ]);
      
      // Semua siswa yang ada di database bisa di-assign
      setStudents(studentsData);
      setKelas(kelasData);
      if (kelasData.length > 0 && !selectedKelasId) {
        setSelectedKelasId(kelasData[0].id_kelas);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const [allStudentsInSemester, setAllStudentsInSemester] = useState([]);

  const fetchStudentsInKelas = async (kelasId, taSemesterId) => {
    if (!kelasId || !taSemesterId) {
      setStudentsInSelectedKelas([]);
      return;
    }
    try {
      const data = await adminApi.getSiswaInKelas(kelasId, taSemesterId);
      setStudentsInSelectedKelas(data);
    } catch (err) {
      console.error("Error fetching students in class:", err);
      setStudentsInSelectedKelas([]);
    }
  };

  const fetchAllStudentsInSemester = async (taSemesterId) => {
    if (!taSemesterId || kelas.length === 0) {
      setAllStudentsInSemester([]);
      return;
    }
    try {
      // Fetch all students enrolled in ANY class for this semester
      const allKelasIds = kelas.map(k => k.id_kelas);
      const allEnrolledIds = new Set();
      
      for (const kelasId of allKelasIds) {
        const studentsInKelas = await adminApi.getSiswaInKelas(kelasId, taSemesterId);
        studentsInKelas.forEach(s => allEnrolledIds.add(s.id_siswa));
      }
      
      console.log('All enrolled students in semester:', Array.from(allEnrolledIds));
      setAllStudentsInSemester(Array.from(allEnrolledIds));
    } catch (err) {
      console.error("Error fetching all students in semester:", err);
      setAllStudentsInSemester([]);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTASemester]);

  useEffect(() => {
    fetchStudentsInKelas(selectedKelasId, activeTASemester?.id_ta_semester);
    fetchAllStudentsInSemester(activeTASemester?.id_ta_semester);
  }, [selectedKelasId, activeTASemester, kelas]);

  // Auto-refresh data ketika tab/window di-focus kembali
  useEffect(() => {
    const handleFocus = () => {
      if (isImporting || waitingForFile) {
        // Avoid auto refresh during an ongoing import (avoids confusing UI refresh)
        console.log('Window focused but import in progress; skipping auto-refresh');
        return;
      }
      console.log('Window focused, refreshing data');
      fetchData();
    };
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [isImporting, waitingForFile]);
  

  const showMessage = (text, type = 'success') => {
    setMessage(text);
    setMessageType(type);
    
    setTimeout(() => {
      setMessage('');
      setMessageType('');
    }, 5000);
  };

  const handleCheckboxChange = (studentId) => {
    setSelectedStudents(prevSelected => {
      if (prevSelected.includes(studentId)) {
        return prevSelected.filter(id => id !== studentId);
      } else {
        return [...prevSelected, studentId];
      }
    });
  };

  const availableStudents = students.filter(s =>
    !allStudentsInSemester.includes(s.id_siswa)
  );

  const filteredAvailableStudents = availableStudents.filter(student => {
    const q = (searchTerm || '').trim().toLowerCase();
    if (!q) return true;
    const name = (student.nama_siswa || '').toLowerCase();
    const nisn = String(student.id_siswa || '').toLowerCase();
    return name.includes(q) || nisn.includes(q);
  });

  const handleSelectAll = () => {
    if (selectedStudents.length === filteredAvailableStudents.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(filteredAvailableStudents.map(s => s.id_siswa));
    }
  };

  const handleAssignStudents = async () => {
    setMessage('');
    setMessageType('');
    setIsAssigning(true);
    
    if (!selectedKelasId || !activeTASemester || selectedStudents.length === 0) {
      showMessage('Please select a class and at least one student.', 'error');
      setIsAssigning(false);
      return;
    }

    let successCount = 0;
    let failCount = 0;

    const assignmentPromises = selectedStudents.map(studentId => {
      return adminApi.assignSiswaToKelas({
        id_siswa: studentId,
        id_kelas: selectedKelasId,
        id_ta_semester: activeTASemester.id_ta_semester
      })
      .then(() => {
        successCount++;
      })
      .catch(err => {
        console.error(`Failed to assign student ${studentId}:`, err);
        failCount++;
      });
    });

    try {
      await Promise.all(assignmentPromises);

      if (successCount > 0) {
        showMessage(`Successfully assigned ${successCount} students to the class.`, 'success');
        setSelectedStudents([]);
        fetchStudentsInKelas(selectedKelasId, activeTASemester.id_ta_semester);
        fetchAllStudentsInSemester(activeTASemester.id_ta_semester);
      } else if (failCount > 0) {
        showMessage(`Failed to assign ${failCount} students. They might already be enrolled.`, 'error');
      }
    } catch (err) {
      showMessage(`Error during assignment: ${err.message}`, 'error');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleRemoveClick = (student) => {
    console.log('handleRemoveClick called with student:', student);
    setDeleteConfirm({ show: true, student });
    console.log('deleteConfirm state should be updated now');
  };

  const confirmRemoveStudent = async () => {
    const { student } = deleteConfirm;
    console.log('confirmRemoveStudent called');
    console.log('deleteConfirm.student:', deleteConfirm.student);
    console.log('selectedKelasId:', selectedKelasId);
    console.log('activeTASemester:', activeTASemester);
    
    if (!student || !selectedKelasId || !activeTASemester) {
      console.error('Missing required data', { student, selectedKelasId, activeTASemester });
      showMessage('Error: Missing required data', 'error');
      return;
    }
    
    try {
      console.log('Calling unassignSiswaFromKelas with:', {
        id_siswa: student.id_siswa,
        id_kelas: selectedKelasId,
        id_ta_semester: activeTASemester.id_ta_semester
      });
      
      const response = await adminApi.unassignSiswaFromKelas({
        id_siswa: student.id_siswa,
        id_kelas: selectedKelasId,
        id_ta_semester: activeTASemester.id_ta_semester
      });
      console.log('Remove response:', response);
      showMessage(`Successfully removed "${student.nama_siswa}" from class.`, 'success');
      fetchStudentsInKelas(selectedKelasId, activeTASemester.id_ta_semester);
      fetchAllStudentsInSemester(activeTASemester.id_ta_semester);
    } catch (err) {
      console.error('Remove error:', err);
      showMessage(`Failed to remove student: ${err.message}`, 'error');
    } finally {
      setDeleteConfirm({ show: false, student: null });
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      await adminApi.downloadEnrollmentTemplate();
      showMessage('Template berhasil didownload!', 'success');
    } catch (err) {
      showMessage('Gagal download template: ' + err.message, 'error');
    }
  };

  const fileInputRef = useRef(null);

  const handleImportExcel = async (event) => {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    const file = event.target.files[0];
    if (!file) return;
    setWaitingForFile(false); // file chosen, stop waiting state

    setIsImporting(true);
    showMessage('Importing file, please wait...', 'info');
    try {
      console.log('[UI] handleImportExcel started, file:', file);
      setImportErrors([]);
      const result = await adminApi.importEnrollment(file);
      console.log('[UI] importEnrollment result:', result);
      // Show main result message (success/failure summary)
      showMessage(result.message, 'success');
      
      if (result.details && result.details.errors && result.details.errors.length > 0) {
        console.warn('Import errors:', result.details.errors);
        setImportErrors(result.details.errors);
        // Show a more visible warning to user if some rows failed
        showMessage(`Import completed; ${result.details.failed} failed rows. See errors below.`, 'warning');
      }
      else {
        setImportErrors([]);
      }
      
      // Refresh data
      fetchStudentsInKelas(selectedKelasId, activeTASemester?.id_ta_semester);
      fetchAllStudentsInSemester(activeTASemester?.id_ta_semester);
      if (event && event.target) {
        event.target.value = '';
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      // If there are detailed errors from server, show them in the UI
      if (err.details && Array.isArray(err.details.errors) && err.details.errors.length > 0) {
        setImportErrors(err.details.errors);
        showMessage(err.message || 'Gagal import: lihat detail', 'error');
      } else {
        showMessage('Gagal import: ' + err.message, 'error');
      }
    } finally {
      setIsImporting(false);
    }
  };

  const selectedClass = kelas.find(k => k.id_kelas === selectedKelasId);

  const renderStudentCard = (student, isSelected) => (
    <div 
      key={student.id_siswa}
      className={`relative bg-white rounded-xl border-2 p-4 cursor-pointer transition-all duration-300 transform hover:-translate-y-1 hover:shadow-lg ${
        isSelected 
          ? 'border-blue-500 bg-blue-50 shadow-lg' 
          : 'border-gray-200 hover:border-blue-300'
      }`}
      onClick={() => handleCheckboxChange(student.id_siswa)}
    >
      <div className="flex items-center space-x-3">
        <div className={`relative w-10 h-10 rounded-full flex items-center justify-center ${
          isSelected 
            ? 'bg-blue-500 text-white' 
            : 'bg-gradient-to-br from-blue-400 to-indigo-500 text-white'
        }`}>
          {isSelected ? (
            <i className="fas fa-check text-sm"></i>
          ) : (
            <i className="fas fa-user text-sm"></i>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-gray-900 truncate">{student.nama_siswa}</h4>
          <p className="text-xs text-gray-500">NISN: {student.id_siswa}</p>
        </div>
      </div>
      {isSelected && (
        <div className="absolute top-2 right-2">
          <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
            <i className="fas fa-check text-white text-xs"></i>
          </div>
        </div>
      )}
    </div>
  );

  const renderStudentList = (student, isSelected) => (
    <div 
      key={student.id_siswa}
      className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-all duration-200 ${
        isSelected 
          ? 'bg-blue-50 border border-blue-200' 
          : 'bg-white hover:bg-gray-50 border border-gray-200'
      }`}
      onClick={() => handleCheckboxChange(student.id_siswa)}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
        isSelected 
          ? 'bg-blue-500 text-white' 
          : 'bg-gradient-to-br from-blue-400 to-indigo-500 text-white'
      }`}>
        {isSelected ? (
          <i className="fas fa-check text-xs"></i>
        ) : (
          <i className="fas fa-user text-xs"></i>
        )}
      </div>
      <div className="flex-1">
        <h4 className="text-sm font-medium text-gray-900">{student.nama_siswa}</h4>
        <p className="text-xs text-gray-500">NISN: {student.id_siswa}</p>
      </div>
      {isSelected && (
        <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
          <i className="fas fa-check text-white text-xs"></i>
        </div>
      )}
    </div>
  );

  const enrolledStudentsColumns = [
    { 
      key: 'id_siswa', 
      label: 'NISN',
      render: (value) => <span className="font-medium">{value}</span>
    },
    { 
      key: 'nama_siswa', 
      label: 'Nama Siswa',
      render: (value) => (
        <div className="flex items-center">
          <div className="bg-gradient-to-br from-blue-400 to-indigo-500 p-2 rounded-full mr-3">
            <i className="fas fa-user text-white text-xs"></i>
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
          Enrolled
        </span>
      )
    }
  ];

  // Stats data
  const statsData = [
    {
      label: 'Total Siswa',
      value: students.length,
      icon: 'users',
      gradient: 'from-blue-400 to-indigo-500'
    },
    {
      label: 'Kelas Tersedia',
      value: kelas.length,
      icon: 'door-open',
      gradient: 'from-emerald-400 to-cyan-500'
    },
    {
      label: 'Di Kelas Terpilih',
      value: studentsInSelectedKelas.length,
      icon: 'user-check',
      gradient: 'from-purple-400 to-pink-500'
    },
    {
      label: 'Terpilih untuk Ditugaskan',
      value: selectedStudents.length,
      icon: 'user-plus',
      gradient: 'from-orange-400 to-red-500'
    }
  ];

  return (
    <ModuleContainer>
      <PageHeader
        icon="users-cog"
        title="Penugasan Siswa ke Kelas"
        subtitle="Menugaskan siswa ke kelas untuk tahun ajaran dan semester aktif"
        badge={activeTASemester ? `${activeTASemester.tahun_ajaran} - ${activeTASemester.semester}` : 'No Active Term'}
        action={
          <Button
            variant="secondary"
            icon="sync-alt"
            onClick={fetchData}
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
                <p className="text-xl sm:text-2xl font-bold">{stat.value}</p>
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

      {loading && <LoadingSpinner message="Loading enrollment data..." />}

      {error && (
        <StatusMessage 
          type="error"
          message={error}
          icon="exclamation-circle"
        />
      )}

      {!loading && !error && (
        <>
          {!activeTASemester && (
            <StatusMessage 
              type="warning"
              message="Please set an active Academic Year & Semester first."
              icon="exclamation-triangle"
              className="mb-6"
            />
          )}

          {kelas.length > 0 ? (
            <div className="space-y-8">
              {/* Class Selection */}
              <FormSection 
                title="Pilih Kelas Target" 
                icon="door-open"
                variant="primary"
              >
                <div className="form-group">
                  <label>
                    <i className="fas fa-chalkboard mr-2 text-gray-500"></i>
                    Kelas Target
                  </label>
                  <select 
                    value={selectedKelasId} 
                    onChange={(e) => setSelectedKelasId(parseInt(e.target.value))}
                    className="w-full"
                  >
                    {kelas.map(k => (
                      <option key={k.id_kelas} value={k.id_kelas}>{k.nama_kelas}</option>
                    ))}
                  </select>
                </div>
              </FormSection>

              {/* Import Excel Section */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                  <i className="fas fa-file-excel text-green-600 mr-2 text-xl"></i>
                  Import Enrollment dari Excel
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button
                    variant="primary"
                    icon="download"
                    onClick={handleDownloadTemplate}
                    type="button"
                    fullWidth
                  >
                    Download Template Excel
                  </Button>
                  <div>
                    <input
                      id="excel-upload-enrollment"
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx, .xls"
                      onClick={(e) => e.stopPropagation()}
                      onChange={handleImportExcel}
                      style={{ display: 'none' }}
                    />
                    <Button
                      variant="success"
                      icon="upload"
                      onClick={() => {
                        setWaitingForFile(true);
                        // start a fallback to clear waitingForFile if user cancels file dialog
                        setTimeout(() => setWaitingForFile(false), 10000);
                        fileInputRef.current && fileInputRef.current.click();
                      }}
                      type="button"
                      loading={isImporting}
                      disabled={isImporting}
                      fullWidth
                    >
                      {isImporting ? 'Mengimport...' : 'Upload & Import Excel'}
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mt-3">
                  <i className="fas fa-info-circle mr-1"></i>
                  Download template, isi NISN dan Nama Kelas, lalu upload untuk enroll otomatis ke semester aktif
                </p>
                {importErrors && importErrors.length > 0 && (
                  <div className="mt-3 bg-red-50 border border-red-200 rounded p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium text-red-800">Import Errors ({importErrors.length})</div>
                      <div>
                        <button
                          className="text-sm text-red-700 underline"
                          onClick={() => {
                            navigator.clipboard.writeText(importErrors.join('\n'));
                            showMessage('Errors copied to clipboard', 'success');
                          }}
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                    <ul className="text-xs text-red-700 max-h-40 overflow-auto list-disc list-inside">
                      {importErrors.slice(0, 50).map((err, idx) => (
                        <li key={`err-${idx}`}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Current Students in Class */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center">
                    <i className="fas fa-users mr-3 text-purple-500 text-2xl sm:text-3xl"></i>
                    Siswa di Kelas {selectedClass?.nama_kelas || 'Kelas Terpilih'}
                  </h3>
                  <span className="bg-purple-100 text-purple-600 px-3 py-1 rounded-full text-sm font-medium">
                    {studentsInSelectedKelas.length} ditugaskan
                  </span>
                </div>
                
                {studentsInSelectedKelas.length > 0 ? (
                  <div className="space-y-4">
                    <Table
                      columns={enrolledStudentsColumns}
                      data={studentsInSelectedKelas.slice((enrolledPageCurrent - 1) * itemsPerPage, enrolledPageCurrent * itemsPerPage)}
                      actions={(student) => {
                        console.log('Rendering action for student:', student);
                        return (
                          <Button
                            variant="danger"
                            icon="user-minus"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              console.log('Remove clicked for:', student);
                              handleRemoveClick(student);
                            }}
                          >
                            Remove
                          </Button>
                        );
                      }}
                    />
                    
                    {/* Pagination for Enrolled Students */}
                    {studentsInSelectedKelas.length > itemsPerPage && (
                      <div className="bg-white rounded-lg shadow p-4 flex items-center justify-between">
                        <div className="text-sm text-gray-600">
                          Halaman {enrolledPageCurrent} dari {Math.ceil(studentsInSelectedKelas.length / itemsPerPage)} 
                          ({(enrolledPageCurrent - 1) * itemsPerPage + 1} - {Math.min(enrolledPageCurrent * itemsPerPage, studentsInSelectedKelas.length)} dari {studentsInSelectedKelas.length})
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            icon="chevron-left"
                            onClick={() => setEnrolledPageCurrent(prev => Math.max(1, prev - 1))}
                            disabled={enrolledPageCurrent === 1}
                          >
                            Sebelumnya
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon="chevron-right"
                            onClick={() => setEnrolledPageCurrent(prev => Math.min(Math.ceil(studentsInSelectedKelas.length / itemsPerPage), prev + 1))}
                            disabled={enrolledPageCurrent === Math.ceil(studentsInSelectedKelas.length / itemsPerPage)}
                          >
                            Selanjutnya
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <EmptyState
                    icon="user-slash"
                    title="No Students Enrolled"
                    message="This class has no students enrolled for the active semester."
                  />
                )}
              </div>

              {/* Add Students Section */}
              <div>
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6 gap-4">
                  <h3 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center">
                    <i className="fas fa-user-plus mr-3 text-blue-500 text-2xl sm:text-3xl"></i>
                    Tambahkan Siswa ke Kelas
                    <span className="ml-2 bg-blue-100 text-blue-600 px-2 py-1 rounded-full text-sm">
                      {filteredAvailableStudents.length} tersedia
                    </span>
                  </h3>
                  
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1 sm:flex-none">
                      <input 
                        type="text" 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search students or NISN..." 
                        className="w-full sm:w-auto pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <i className="fas fa-search absolute left-3 top-3 text-gray-400"></i>
                    </div>
                    
                    <div className="flex bg-gray-100 rounded-lg p-1">
                      <button 
                        onClick={() => setViewMode('list')}
                        className={`px-3 py-1 rounded-md transition-all duration-200 ${viewMode === 'list' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600'}`}
                        title="List View"
                      >
                        <i className="fas fa-list"></i>
                      </button>
                      <button 
                        onClick={() => setViewMode('grid')}
                        className={`px-3 py-1 rounded-md transition-all duration-200 ${viewMode === 'grid' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600'}`}
                        title="Grid View"
                      >
                        <i className="fas fa-th"></i>
                      </button>
                    </div>
                  </div>
                </div>

                {filteredAvailableStudents.length > 0 ? (
                  <div className="space-y-6">
                    {/* Select All & Action Buttons */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-blue-50 p-4 rounded-xl border border-blue-200">
                      <div className="flex items-center space-x-4">
                        <button 
                          onClick={handleSelectAll}
                          className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 transition-colors duration-200"
                        >
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                            selectedStudents.length === filteredAvailableStudents.length && filteredAvailableStudents.length > 0
                              ? 'bg-blue-500 border-blue-500' 
                              : selectedStudents.length > 0
                              ? 'bg-blue-200 border-blue-400'
                              : 'border-gray-300'
                          }`}>
                            {selectedStudents.length === filteredAvailableStudents.length && filteredAvailableStudents.length > 0 ? (
                              <i className="fas fa-check text-white text-xs"></i>
                            ) : selectedStudents.length > 0 ? (
                              <i className="fas fa-minus text-blue-600 text-xs"></i>
                            ) : null}
                          </div>
                          <span className="font-medium">
                            {selectedStudents.length === filteredAvailableStudents.length && filteredAvailableStudents.length > 0
                              ? 'Deselect All' 
                              : 'Select All'}
                          </span>
                        </button>
                        <span className="text-sm text-gray-600">
                          {selectedStudents.length} of {filteredAvailableStudents.length} selected
                        </span>
                      </div>
                      
                      <Button
                        variant="primary"
                        icon={isAssigning ? 'spinner' : 'user-plus'}
                        onClick={handleAssignStudents}
                        disabled={!activeTASemester || selectedStudents.length === 0 || isAssigning}
                        className="mt-3 sm:mt-0"
                      >
                        {isAssigning ? 'Assigning...' : `Assign ${selectedStudents.length} Student${selectedStudents.length !== 1 ? 's' : ''}`}
                      </Button>
                    </div>

                    {/* Students Display */}
                    {viewMode === 'grid' ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                          {filteredAvailableStudents.slice((availablePageCurrent - 1) * itemsPerPage, availablePageCurrent * itemsPerPage).map(student => 
                            renderStudentCard(student, selectedStudents.includes(student.id_siswa))
                          )}
                        </div>
                        
                        {/* Pagination for Available Students */}
                        {filteredAvailableStudents.length > itemsPerPage && (
                          <div className="bg-white rounded-lg shadow p-4 flex items-center justify-between">
                            <div className="text-sm text-gray-600">
                              Halaman {availablePageCurrent} dari {Math.ceil(filteredAvailableStudents.length / itemsPerPage)} 
                              ({(availablePageCurrent - 1) * itemsPerPage + 1} - {Math.min(availablePageCurrent * itemsPerPage, filteredAvailableStudents.length)} dari {filteredAvailableStudents.length})
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                icon="chevron-left"
                                onClick={() => setAvailablePageCurrent(prev => Math.max(1, prev - 1))}
                                disabled={availablePageCurrent === 1}
                              >
                                Sebelumnya
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                icon="chevron-right"
                                onClick={() => setAvailablePageCurrent(prev => Math.min(Math.ceil(filteredAvailableStudents.length / itemsPerPage), prev + 1))}
                                disabled={availablePageCurrent === Math.ceil(filteredAvailableStudents.length / itemsPerPage)}
                              >
                                Selanjutnya
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          {filteredAvailableStudents.slice((availablePageCurrent - 1) * itemsPerPage, availablePageCurrent * itemsPerPage).map(student => 
                            renderStudentList(student, selectedStudents.includes(student.id_siswa))
                          )}
                        </div>
                        
                        {/* Pagination for Available Students */}
                        {filteredAvailableStudents.length > itemsPerPage && (
                          <div className="bg-white rounded-lg shadow p-4 flex items-center justify-between">
                            <div className="text-sm text-gray-600">
                              Halaman {availablePageCurrent} dari {Math.ceil(filteredAvailableStudents.length / itemsPerPage)} 
                              ({(availablePageCurrent - 1) * itemsPerPage + 1} - {Math.min(availablePageCurrent * itemsPerPage, filteredAvailableStudents.length)} dari {filteredAvailableStudents.length})
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                icon="chevron-left"
                                onClick={() => setAvailablePageCurrent(prev => Math.max(1, prev - 1))}
                                disabled={availablePageCurrent === 1}
                              >
                                Sebelumnya
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                icon="chevron-right"
                                onClick={() => setAvailablePageCurrent(prev => Math.min(Math.ceil(filteredAvailableStudents.length / itemsPerPage), prev + 1))}
                                disabled={availablePageCurrent === Math.ceil(filteredAvailableStudents.length / itemsPerPage)}
                              >
                                Selanjutnya
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <EmptyState
                    icon="user-check"
                    title={searchTerm ? 'No Students Match Search' : 'All Students Enrolled'}
                    message={
                      searchTerm 
                        ? `No available students match your search for "${searchTerm}".`
                        : 'All students are already enrolled in this class or no students are available.'
                    }
                  />
                )}
              </div>
            </div>
          ) : (
            <EmptyState
              icon="door-closed"
              title="No Classes Available"
              message="No classes are registered for the active academic term."
            />
          )}
        </>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirm.show && (
        <>
          {console.log('ConfirmDialog rendering with deleteConfirm:', deleteConfirm)}
          <ConfirmDialog
            show={deleteConfirm.show}
            title="Keluarkan Siswa dari Kelas"
            message={`Apakah Anda yakin ingin mengeluarkan "${deleteConfirm.student?.nama_siswa}" dari kelas ini? Semua nilai yang ada akan disimpan, dan siswa dapat didaftarkan kembali nanti.`}
            confirmText="Remove"
            cancelText="Cancel"
            onConfirm={confirmRemoveStudent}
            onCancel={() => {
              console.log('Cancel button clicked');
              setDeleteConfirm({ show: false, student: null });
            }}
            variant="danger"
          />
        </>
      )}
    </ModuleContainer>
  );
};

export default StudentClassEnroll;
