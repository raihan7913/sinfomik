// frontend/src/features/admin/teacherClassEnroll.js
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

const TeacherClassEnroll = ({ activeTASemester }) => {
  const [teachers, setTeachers] = useState([]);
  const [mataPelajaran, setMataPelajaran] = useState([]);
  const [kelas, setKelas] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [selectedGuruId, setSelectedGuruId] = useState('');
  const [selectedMapelId, setSelectedMapelId] = useState('');
  const [selectedKelasId, setSelectedKelasId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('grouped');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedTeacherDetail, setSelectedTeacherDetail] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, assignment: null });

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [teachersData, mapelData, kelasData, assignmentsData] = await Promise.all([
        adminApi.getTeachers(),
        adminApi.getMataPelajaran(),
        activeTASemester ? adminApi.getKelas(activeTASemester.id_ta_semester) : Promise.resolve([]),
        activeTASemester ? adminApi.getGuruMapelKelasAssignments(activeTASemester.id_ta_semester) : Promise.resolve([])
      ]);
      setTeachers(teachersData);
      setMataPelajaran(mapelData);
      setKelas(kelasData);
      setAssignments(assignmentsData);

      if (teachersData.length > 0 && !selectedGuruId) setSelectedGuruId(String(teachersData[0].id_guru));
      if (mapelData.length > 0 && !selectedMapelId) setSelectedMapelId(mapelData[0].id_mapel);
      if (kelasData.length > 0 && !selectedKelasId) setSelectedKelasId(kelasData[0].id_kelas);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTASemester]);

  const showMessage = (text, type = 'success') => {
    setMessage(text);
    setMessageType(type);
    
    setTimeout(() => {
      setMessage('');
      setMessageType('');
    }, 5000);
  };

  const handleAssignGuru = async (e) => {
    e.preventDefault();
    setMessage('');
    setMessageType('');
    setIsAssigning(true);
    
    if (!activeTASemester || !selectedGuruId || !selectedMapelId || !selectedKelasId) {
      showMessage('Please complete all selections.', 'error');
      setIsAssigning(false);
      return;
    }

    try {
      const response = await adminApi.assignGuruToMapelKelas({
        id_guru: selectedGuruId,
        id_mapel: selectedMapelId,
        id_kelas: selectedKelasId,
        id_ta_semester: activeTASemester.id_ta_semester
      });
      showMessage(response.message, 'success');
      fetchData();
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setIsAssigning(false);
    }
  };

  const getSubjectIcon = (namaMapel) => {
    const subject = namaMapel.toLowerCase();
    if (subject.includes('math') || subject.includes('matematika')) return 'fa-calculator';
    if (subject.includes('science') || subject.includes('ipa') || subject.includes('fisika') || subject.includes('kimia') || subject.includes('biologi')) return 'fa-flask';
    if (subject.includes('english') || subject.includes('bahasa')) return 'fa-language';
    if (subject.includes('history') || subject.includes('sejarah')) return 'fa-landmark';
    if (subject.includes('geography') || subject.includes('geografi')) return 'fa-globe';
    if (subject.includes('art') || subject.includes('seni')) return 'fa-palette';
    if (subject.includes('sport') || subject.includes('olahraga') || subject.includes('penjaskes')) return 'fa-running';
    if (subject.includes('computer') || subject.includes('tik') || subject.includes('komputer')) return 'fa-laptop';
    if (subject.includes('religion') || subject.includes('agama')) return 'fa-pray';
    return 'fa-book';
  };

  const getRandomColor = (index) => {
    const colors = [
      'from-rose-400 to-pink-500',
      'from-orange-400 to-amber-500', 
      'from-emerald-400 to-cyan-500',
      'from-blue-400 to-indigo-500',
      'from-purple-400 to-violet-500',
      'from-pink-400 to-rose-500',
      'from-teal-400 to-green-500',
      'from-indigo-400 to-blue-500'
    ];
    return colors[index % colors.length];
  };

  const filteredAssignments = assignments.filter(assignment =>
    assignment.nama_guru.toLowerCase().includes(searchTerm.toLowerCase()) ||
    assignment.nama_mapel.toLowerCase().includes(searchTerm.toLowerCase()) ||
    assignment.nama_kelas.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const groupedAssignments = () => {
    const grouped = {};
    
    filteredAssignments.forEach((assignment) => {
      const teacherKey = assignment.id_guru;
      
      if (!grouped[teacherKey]) {
        grouped[teacherKey] = {
          teacher: {
            id_guru: assignment.id_guru,
            nama_guru: assignment.nama_guru
          },
          subjects: new Set(),
          classes: new Set(),
          assignments: [],
          isWaliKelas: false
        };
      }
      
      grouped[teacherKey].subjects.add(assignment.nama_mapel);
      grouped[teacherKey].classes.add(assignment.nama_kelas);
      grouped[teacherKey].assignments.push(assignment);
      
      if (assignment.is_wali_kelas === 1) {
        grouped[teacherKey].isWaliKelas = true;
      }
    });
    
    Object.keys(grouped).forEach(key => {
      grouped[key].subjects = Array.from(grouped[key].subjects);
      grouped[key].classes = Array.from(grouped[key].classes);
    });
    
    return grouped;
  };

  const getClassSubjectMapping = (assignments) => {
    const mapping = {};
    assignments.forEach(assignment => {
      const classKey = assignment.nama_kelas;
      if (!mapping[classKey]) {
        mapping[classKey] = {
          kelas: assignment.nama_kelas,
          id_kelas: assignment.id_kelas,
          tahun_ajaran: assignment.tahun_ajaran,
          semester: assignment.semester,
          subjects: []
        };
      }
      mapping[classKey].subjects.push({
        nama_mapel: assignment.nama_mapel,
        id_mapel: assignment.id_mapel,
        assignment: assignment
      });
    });
    return mapping;
  };

  const openTeacherDetail = (teacherGroup) => {
    setSelectedTeacherDetail(teacherGroup);
    setShowDetailModal(true);
  };

  const closeModal = () => {
    setShowDetailModal(false);
    setSelectedTeacherDetail(null);
    setEditMode(false);
    setDeleteConfirm({ show: false, assignment: null });
  };

  const handleDeleteClick = (assignment) => {
    setDeleteConfirm({ show: true, assignment });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm.assignment) return;

    try {
      await adminApi.deleteGuruMapelKelasAssignment(deleteConfirm.assignment.id_guru_mapel_kelas);
      showMessage('Assignment successfully deleted.', 'success');
      setDeleteConfirm({ show: false, assignment: null });
      setShowDetailModal(false);
      setSelectedTeacherDetail(null);
      setEditMode(false);
      fetchData();
    } catch (err) {
      showMessage(err.message || 'Failed to delete assignment.', 'error');
      setDeleteConfirm({ show: false, assignment: null });
    }
  };

  const toggleEditMode = () => {
    setEditMode(!editMode);
  };

  const selectedTeacher = teachers.find(t => t.id_guru === selectedGuruId);
  const selectedSubject = mataPelajaran.find(mp => mp.id_mapel === selectedMapelId);
  const selectedClass = kelas.find(k => k.id_kelas === selectedKelasId);

  const renderGroupedAssignmentsCards = () => {
    const grouped = groupedAssignments();
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.values(grouped).map((group, index) => (
          <div 
            key={group.teacher.id_guru} 
            className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 border border-gray-100 flex flex-col h-full cursor-pointer"
            onClick={() => openTeacherDetail(group)}
          >
            <div className={`bg-gradient-to-r ${getRandomColor(index)} p-4`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="bg-white/20 p-3 rounded-full mr-3">
                    <i className="fas fa-chalkboard-teacher text-white text-xl"></i>
                  </div>
                  <div>
                    <div className="flex items-center">
                      <h3 className="text-white font-semibold text-lg mr-2">{group.teacher.nama_guru}</h3>
                      {group.isWaliKelas && (
                        <span className="bg-yellow-400 text-yellow-900 px-2 py-1 rounded-full text-xs font-bold flex items-center">
                          <i className="fas fa-home mr-1"></i>
                          Wali
                        </span>
                      )}
                    </div>
                    <p className="text-white/80 text-sm">ID: {group.teacher.id_guru}</p>
                  </div>
                </div>
                <div className="bg-white/20 px-3 py-1 rounded-full">
                  <span className="text-white text-sm font-bold">{group.assignments.length}</span>
                </div>
              </div>
            </div>
            <div className="p-4 flex-1 flex flex-col justify-between">
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-500 mb-2">Subjects ({group.subjects.length})</p>
                  <div className="flex flex-wrap gap-1">
                    {group.subjects.map((subject, idx) => (
                      <span key={idx} className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
                        <i className={`fas ${getSubjectIcon(subject)} mr-1`}></i>
                        {subject}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-2">Classes ({group.classes.length})</p>
                  <div className="flex flex-wrap gap-1">
                    {group.classes.map((kelas, idx) => (
                      <span key={idx} className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-indigo-100 text-indigo-800">
                        <i className="fas fa-door-open mr-1"></i>
                        {kelas}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex justify-between items-center pt-4 border-t border-gray-100 mt-auto">
                <span className="text-xs text-gray-500">{group.assignments[0]?.tahun_ajaran}</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                  {group.assignments[0]?.semester}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const assignmentColumns = [
    {
      key: 'nama_guru',
      label: 'Teacher',
      render: (value, row) => (
        <div className="flex items-center">
          <div className="bg-gradient-to-br from-rose-400 to-pink-500 p-2 rounded-full mr-3">
            <i className="fas fa-chalkboard-teacher text-white text-sm"></i>
          </div>
          <div>
            <span className="font-medium">{value}</span>
            {row.is_wali_kelas === 1 && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800">
                <i className="fas fa-home mr-1"></i>
                Wali Kelas
              </span>
            )}
          </div>
        </div>
      )
    },
    {
      key: 'nama_mapel',
      label: 'Subject',
      render: (value, row, index) => (
        <div className="flex items-center">
          <div className={`bg-gradient-to-br ${getRandomColor(index)} p-2 rounded-lg mr-3`}>
            <i className={`fas ${getSubjectIcon(value)} text-white text-sm`}></i>
          </div>
          <span className="font-medium">{value}</span>
        </div>
      )
    },
    {
      key: 'nama_kelas',
      label: 'Class',
      render: (value) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
          <i className="fas fa-door-open mr-1"></i>
          {value}
        </span>
      )
    },
    {
      key: 'tahun_ajaran',
      label: 'Academic Year',
      render: (value) => <span className="font-medium">{value}</span>
    },
    {
      key: 'semester',
      label: 'Semester',
      render: (value) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
          {value}
        </span>
      )
    }
  ];

  const statsData = [
    {
      label: 'Teachers',
      value: teachers.length,
      icon: 'chalkboard-teacher',
      gradient: 'from-emerald-400 to-cyan-400'
    },
    {
      label: 'Subjects',
      value: mataPelajaran.length,
      icon: 'book',
      gradient: 'from-orange-400 to-amber-500'
    },
    {
      label: 'Classes',
      value: kelas.length,
      icon: 'door-open',
      gradient: 'from-blue-400 to-indigo-500'
    },
    {
      label: 'Assignments',
      value: assignments.length,
      icon: 'tasks',
      gradient: 'from-purple-400 to-pink-500'
    }
  ];

  return (
    <ModuleContainer>
      <PageHeader
        icon="chalkboard-teacher"
        title="Teacher Class Assignment"
        subtitle="Assign teachers to subjects and classes"
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

      {loading && <LoadingSpinner message="Loading teacher assignments..." />}

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

          {teachers.length > 0 && mataPelajaran.length > 0 && kelas.length > 0 ? (
            <div className="space-y-8">
              {/* Assignment Form */}
              <FormSection 
                title="Assign Teacher" 
                icon="user-plus"
                variant="success"
              >
                <form onSubmit={handleAssignGuru} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                    <div className="form-group">
                      <label>
                        <i className="fas fa-chalkboard-teacher mr-2 text-gray-500"></i>
                        Teacher
                      </label>
                      <select 
                        value={selectedGuruId} 
                        onChange={(e) => setSelectedGuruId(e.target.value)}
                        required
                      >
                        {teachers.map(t => (
                          <option key={t.id_guru} value={t.id_guru}>{t.nama_guru}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label>
                        <i className="fas fa-book mr-2 text-gray-500"></i>
                        Subject
                      </label>
                      <select 
                        value={selectedMapelId} 
                        onChange={(e) => setSelectedMapelId(parseInt(e.target.value))}
                        required
                      >
                        {mataPelajaran.map(mp => (
                          <option key={mp.id_mapel} value={mp.id_mapel}>{mp.nama_mapel}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label>
                        <i className="fas fa-door-open mr-2 text-gray-500"></i>
                        Class
                      </label>
                      <select 
                        value={selectedKelasId} 
                        onChange={(e) => setSelectedKelasId(parseInt(e.target.value))}
                        required
                      >
                        {kelas.map(k => (
                          <option key={k.id_kelas} value={k.id_kelas}>{k.nama_kelas}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Assignment Preview */}
                  {selectedTeacher && selectedSubject && selectedClass && (
                    <div className="bg-white p-4 rounded-lg border border-gray-200">
                      <h4 className="text-sm font-medium text-gray-700 mb-3">Assignment Preview:</h4>
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center">
                          <div className="bg-gradient-to-br from-rose-400 to-pink-500 p-2 rounded-full mr-2">
                            <i className="fas fa-chalkboard-teacher text-white text-sm"></i>
                          </div>
                          <span className="text-sm font-medium">{selectedTeacher.nama_guru}</span>
                        </div>
                        <i className="fas fa-arrow-right text-gray-400"></i>
                        <div className="flex items-center">
                          <div className="bg-gradient-to-br from-orange-400 to-amber-500 p-2 rounded-lg mr-2">
                            <i className={`fas ${getSubjectIcon(selectedSubject.nama_mapel)} text-white text-sm`}></i>
                          </div>
                          <span className="text-sm font-medium">{selectedSubject.nama_mapel}</span>
                        </div>
                        <i className="fas fa-arrow-right text-gray-400"></i>
                        <div className="flex items-center">
                          <div className="bg-gradient-to-br from-indigo-400 to-blue-500 p-2 rounded-lg mr-2">
                            <i className="fas fa-door-open text-white text-sm"></i>
                          </div>
                          <span className="text-sm font-medium">{selectedClass.nama_kelas}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <Button
                    type="submit"
                    variant="success"
                    icon={isAssigning ? 'spinner' : 'user-plus'}
                    disabled={!activeTASemester || isAssigning}
                    className="w-full"
                  >
                    {isAssigning ? 'Assigning Teacher...' : 'Assign Teacher'}
                  </Button>
                </form>
              </FormSection>

              {/* Assignments List */}
              <div>
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6 gap-4">
                  <h3 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center">
                    <i className="fas fa-list-check mr-3 text-emerald-500 text-2xl sm:text-3xl"></i>
                    Teacher Assignments
                  </h3>
                  
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1 sm:flex-none">
                      <input 
                        type="text" 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search assignments..." 
                        className="w-full sm:w-auto pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      />
                      <i className="fas fa-search absolute left-3 top-3 text-gray-400"></i>
                    </div>
                    
                    <div className="flex bg-gray-100 rounded-lg p-1">
                      <button 
                        onClick={() => setViewMode('grouped')}
                        className={`px-3 py-1 rounded-md transition-all duration-200 ${viewMode === 'grouped' ? 'bg-white shadow-sm text-emerald-600' : 'text-gray-600'}`}
                        title="Grouped View"
                      >
                        <i className="fas fa-users"></i>
                      </button>
                      <button 
                        onClick={() => setViewMode('table')}
                        className={`px-3 py-1 rounded-md transition-all duration-200 ${viewMode === 'table' ? 'bg-white shadow-sm text-emerald-600' : 'text-gray-600'}`}
                        title="Table View"
                      >
                        <i className="fas fa-table"></i>
                      </button>
                    </div>
                  </div>
                </div>

                {filteredAssignments.length > 0 ? (
                  viewMode === 'grouped' ? renderGroupedAssignmentsCards() : 
                  <Table columns={assignmentColumns} data={filteredAssignments} />
                ) : (
                  <EmptyState
                    icon="clipboard-list"
                    title={searchTerm ? 'No Assignments Match Search' : 'No Teacher Assignments'}
                    message={
                      searchTerm 
                        ? `No assignments match your search for "${searchTerm}".`
                        : 'No teacher assignments are registered for the active semester.'
                    }
                  />
                )}
              </div>
            </div>
          ) : (
            <EmptyState
              icon="exclamation-triangle"
              title="Missing Required Data"
              message="Make sure Teachers, Subjects, and Classes are registered and an Active Academic Year/Semester is set."
            />
          )}
        </>
      )}

      {/* Teacher Detail Modal */}
      {showDetailModal && selectedTeacherDetail && (
        <div className="modal-overlay">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col transform transition-all duration-300">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-emerald-500 to-cyan-600 p-6 rounded-t-2xl flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="bg-white/20 p-3 rounded-full mr-4">
                    <i className="fas fa-chalkboard-teacher text-white text-2xl"></i>
                  </div>
                  <div>
                    <div className="flex items-center">
                      <h2 className="text-2xl font-bold text-white mr-3">{selectedTeacherDetail.teacher.nama_guru}</h2>
                      {selectedTeacherDetail.isWaliKelas && (
                        <span className="bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full text-sm font-bold flex items-center">
                          <i className="fas fa-home mr-2"></i>
                          Wali Kelas
                        </span>
                      )}
                    </div>
                    <p className="text-white/80">Teacher ID: {selectedTeacherDetail.teacher.id_guru}</p>
                    <p className="text-white/80">Total Assignments: {selectedTeacherDetail.assignments.length}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant={editMode ? 'danger' : 'secondary'}
                    icon={editMode ? 'times' : 'edit'}
                    onClick={toggleEditMode}
                    size="sm"
                  >
                    {editMode ? 'Cancel' : 'Edit'}
                  </Button>
                  <button 
                    onClick={closeModal}
                    className="text-white hover:text-blue-200 transition-colors duration-200 p-2 hover:bg-white/20 rounded-full"
                  >
                    <i className="fas fa-times text-2xl"></i>
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-auto p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                <i className="fas fa-list-ul mr-2 text-emerald-500"></i>
                Subject-Class Assignments
              </h3>
              
              <div className="space-y-4">
                {Object.values(getClassSubjectMapping(selectedTeacherDetail.assignments)).map((classData) => {
                  const isWaliKelasForClass = classData.subjects.some(s => s.assignment.is_wali_kelas === 1);
                  
                  return (
                  <div key={classData.kelas} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center flex-1">
                        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-3 rounded-lg mr-4">
                          <i className="fas fa-door-open text-white text-lg"></i>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-gray-800 text-lg">{classData.kelas}</h4>
                            {isWaliKelasForClass && (
                              <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-bold flex items-center">
                                <i className="fas fa-home mr-1"></i>
                                Wali Kelas
                              </span>
                            )}
                          </div>
                          <p className="text-gray-500 text-sm">{classData.tahun_ajaran} - {classData.semester}</p>
                          <p className="text-gray-400 text-xs">{classData.subjects.length} subject{classData.subjects.length > 1 ? 's' : ''}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="ml-16">
                      <div className="flex flex-wrap gap-2">
                        {classData.subjects.map((subjectData, idx) => (
                          <div key={idx} className="relative group">
                            <div className="bg-white border border-gray-300 rounded-lg px-3 py-2 flex items-center space-x-2 hover:shadow-md transition-all duration-200">
                              <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-1.5 rounded-md">
                                <i className={`fas ${getSubjectIcon(subjectData.nama_mapel)} text-white text-xs`}></i>
                              </div>
                              <span className="text-sm font-medium text-gray-700">{subjectData.nama_mapel}</span>
                              
                              {editMode && (
                                <button
                                  onClick={() => handleDeleteClick(subjectData.assignment)}
                                  className="bg-red-500 hover:bg-red-600 text-white p-1 rounded-md ml-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                                  title="Delete this assignment"
                                >
                                  <i className="fas fa-trash text-xs"></i>
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>

              {/* Summary Statistics */}
              <div className="mt-6 bg-gradient-to-r from-emerald-50 to-cyan-50 rounded-xl p-4 border border-emerald-200">
                <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
                  <i className="fas fa-chart-bar mr-2 text-emerald-500"></i>
                  Teaching Summary
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="bg-blue-100 p-3 rounded-lg mb-2">
                      <i className="fas fa-book text-blue-600 text-xl"></i>
                    </div>
                    <p className="text-2xl font-bold text-blue-600">{selectedTeacherDetail.subjects.length}</p>
                    <p className="text-sm text-gray-600">Subject{selectedTeacherDetail.subjects.length > 1 ? 's' : ''}</p>
                  </div>
                  <div className="text-center">
                    <div className="bg-indigo-100 p-3 rounded-lg mb-2">
                      <i className="fas fa-door-open text-indigo-600 text-xl"></i>
                    </div>
                    <p className="text-2xl font-bold text-indigo-600">{selectedTeacherDetail.classes.length}</p>
                    <p className="text-sm text-gray-600">Class{selectedTeacherDetail.classes.length > 1 ? 'es' : ''}</p>
                  </div>
                  <div className="text-center">
                    <div className="bg-green-100 p-3 rounded-lg mb-2">
                      <i className="fas fa-tasks text-green-600 text-xl"></i>
                    </div>
                    <p className="text-2xl font-bold text-green-600">{selectedTeacherDetail.assignments.length}</p>
                    <p className="text-sm text-gray-600">Assignment{selectedTeacherDetail.assignments.length > 1 ? 's' : ''}</p>
                  </div>
                  <div className="text-center">
                    <div className="bg-purple-100 p-3 rounded-lg mb-2">
                      <i className="fas fa-calendar text-purple-600 text-xl"></i>
                    </div>
                    <p className="text-2xl font-bold text-purple-600">{selectedTeacherDetail.assignments[0]?.semester}</p>
                    <p className="text-sm text-gray-600">Semester</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end flex-shrink-0 rounded-b-2xl">
              <Button variant="secondary" onClick={closeModal}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirm.show && (
        <ConfirmDialog
          show={deleteConfirm.show}
          title="Delete Teacher Assignment"
          message={`Are you sure you want to delete this assignment? Teacher: ${selectedTeacherDetail?.teacher.nama_guru}, Subject: ${deleteConfirm.assignment?.nama_mapel}, Class: ${deleteConfirm.assignment?.nama_kelas}`}
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteConfirm({ show: false, assignment: null })}
          variant="danger"
        />
      )}
    </ModuleContainer>
  );
};

export default TeacherClassEnroll;
