// frontend/src/features/admin/StudentManagement.js
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

// Komponen Modal Edit Siswa
const EditStudentModal = ({ student, onClose, onSave }) => {
  const [editedStudent, setEditedStudent] = useState({ ...student });
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditedStudent(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setMessageType('');
    setIsSubmitting(true);
    
    try {
      const dataToUpdate = {
        nama_siswa: editedStudent.nama_siswa,
        tanggal_lahir: editedStudent.tanggal_lahir,
        jenis_kelamin: editedStudent.jenis_kelamin
      };
      
      const response = await adminApi.updateStudent(editedStudent.id_siswa, dataToUpdate);
      setMessage(response.message);
      setMessageType('success');
      
      setTimeout(() => {
        onSave();
        onClose();
      }, 1000);
    } catch (err) {
      setMessage(err.message);
      setMessageType('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content animate-slideInUp">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <i className="fas fa-user-edit text-indigo-600"></i>
            Edit Siswa: {student.nama_siswa}
          </h3>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-2 transition-all"
          >
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>
        
        {message && (
          <div className={`message ${messageType}`}>
            <i className={`fas ${messageType === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i>
            {message}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="form-group">
            <label>
              <i className="fas fa-id-card mr-2 text-gray-500"></i>
              ID Siswa (NISN) - Tidak dapat diubah
            </label>
            <input 
              type="text" 
              value={editedStudent.id_siswa} 
              disabled 
              className="bg-gray-100 cursor-not-allowed"
            />
          </div>
          <div className="form-group">
            <label>
              <i className="fas fa-user mr-2 text-gray-500"></i>
              Nama Siswa
            </label>
            <input
              type="text"
              name="nama_siswa"
              value={editedStudent.nama_siswa}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>
              <i className="fas fa-calendar mr-2 text-gray-500"></i>
              Tanggal Lahir
            </label>
            <input
              type="date"
              name="tanggal_lahir"
              value={editedStudent.tanggal_lahir}
              onChange={handleChange}
            />
          </div>
          <div className="form-group">
            <label>
              <i className="fas fa-venus-mars mr-2 text-gray-500"></i>
              Jenis Kelamin
            </label>
            <select 
              name="jenis_kelamin" 
              value={editedStudent.jenis_kelamin} 
              onChange={handleChange}
            >
              <option value="L">👨 Laki-Laki</option>
              <option value="P">👩 Perempuan</option>
            </select>
          </div>
          <div className="modal-actions">
            <Button 
              type="button" 
              onClick={onClose} 
              variant="ghost"
              disabled={isSubmitting}
            >
              Batal
            </Button>
            <Button 
              type="submit" 
              variant="primary"
              icon="save"
              loading={isSubmitting}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

const StudentManagement = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTASemester, setActiveTASemester] = useState(null);
  const [newStudent, setNewStudent] = useState({
    id_siswa: '',
    nama_siswa: '',
    tanggal_lahir: '',
    jenis_kelamin: 'L',
    tahun_ajaran_masuk: ''
  });
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, student: null });
  const [isImporting, setIsImporting] = useState(false);

  const itemsPerPage = 20;

  const fetchStudents = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.getStudents();
      setStudents(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveTASemester = async () => {
    try {
      const taSemesters = await adminApi.getTASemester();
      const active = taSemesters.find(ta => ta.is_aktif);
      if (active) {
        setActiveTASemester(active);
        // Auto-fill tahun_ajaran_masuk with active TA semester
        setNewStudent(prev => ({
          ...prev,
          tahun_ajaran_masuk: active.tahun_ajaran
        }));
      }
    } catch (err) {
      console.error('Error fetching active TA semester:', err);
    }
  };

  useEffect(() => {
    fetchStudents();
    fetchActiveTASemester();
  }, []);

  const showMessage = (text, type = 'success') => {
    setMessage(text);
    setMessageType(type);
    
    // Hide message after 5 seconds
    setTimeout(() => {
      setMessage('');
      setMessageType('');
    }, 5000);
  };

  const handleAddStudent = async (e) => {
    e.preventDefault();
    setMessage('');
    setMessageType('');
    
    if (!newStudent.id_siswa.trim()) {
      showMessage('Student ID must be filled', 'error');
      return;
    }
    
    try {
      const { id_siswa, nama_siswa, tanggal_lahir, jenis_kelamin, tahun_ajaran_masuk } = newStudent;
      const response = await adminApi.addStudent({ id_siswa, nama_siswa, tanggal_lahir, jenis_kelamin, tahun_ajaran_masuk });
      showMessage(response.message);
      setNewStudent({
        id_siswa: '',
        nama_siswa: '',
        tanggal_lahir: '',
        jenis_kelamin: 'L',
        tahun_ajaran_masuk: activeTASemester?.tahun_ajaran || ''
      });
      fetchStudents(); // Refresh daftar
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  const handleEditClick = (student) => {
    setSelectedStudent(student);
    setShowEditModal(true);
  };

  const handleDeleteClick = (student) => {
    setDeleteConfirm({ show: true, student });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm.student) return;
    
    setMessage('');
    setMessageType('');
    try {
      const response = await adminApi.deleteStudent(deleteConfirm.student.id_siswa);
      showMessage(response.message);
      fetchStudents();
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setDeleteConfirm({ show: false, student: null });
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      await adminApi.downloadStudentTemplate();
      showMessage('✅ Template berhasil diunduh!');
    } catch (err) {
      showMessage(`❌ Gagal download template: ${err.message}`, 'error');
    }
  };

  const handleImportExcel = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsImporting(true);
    showMessage('⏳ Mengupload dan memproses file...', 'info');

    try {
      const result = await adminApi.importStudents(file);
      
      if (result.details && result.details.errors && result.details.errors.length > 0) {
        showMessage(`⚠️ ${result.message}\nError: ${result.details.errors.slice(0, 3).join(', ')}`, 'warning');
      } else {
        showMessage(`✅ ${result.message}`);
      }
      
      fetchStudents(); // Refresh list
    } catch (err) {
      showMessage(`❌ ${err.message}`, 'error');
    } finally {
      setIsImporting(false);
      event.target.value = ''; // Reset file input
    }
  };

  return (
    <ModuleContainer>
      <PageHeader
        icon="user-graduate"
        title="Manajemen Siswa"
        subtitle="Kelola data siswa, tambah siswa baru, dan update informasi siswa"
        badge={`${students.length} Siswa`}
      />
      
      <StatusMessage
        type={messageType}
        message={message}
        onClose={() => setMessage('')}
      />
        
      <FormSection
        title="Tambah Siswa Baru"
        icon="user-plus"
        variant="success"
      >
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-semibold text-blue-900 mb-3">
            <i className="fas fa-file-excel mr-2"></i>
            Import Data Siswa dari Excel
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Button
              variant="success"
              icon="download"
              onClick={handleDownloadTemplate}
              fullWidth
            >
              Download Template Excel
            </Button>
            
            <div>
              <Button
                variant="primary"
                icon="upload"
                disabled={isImporting}
                loading={isImporting}
                fullWidth
                onClick={() => document.getElementById('excel-upload-student').click()}
              >
                {isImporting ? 'Mengupload...' : 'Upload & Import Excel'}
              </Button>
              <input
                id="excel-upload-student"
                type="file"
                accept=".xlsx, .xls"
                onChange={handleImportExcel}
                disabled={isImporting}
                style={{ display: 'none' }}
              />
            </div>
          </div>
          <p className="text-xs text-gray-600 mt-3">
            <i className="fas fa-info-circle mr-1"></i>
            Download template, isi data siswa, lalu upload kembali untuk import massal
          </p>
        </div>

        <h4 className="font-semibold text-gray-700 mb-3 mt-6">
          <i className="fas fa-keyboard mr-2"></i>
          Atau Tambah Manual:
        </h4>
        <form onSubmit={handleAddStudent} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-group">
              <label>ID Siswa (NISN)</label>
              <input 
                type="number" 
                value={newStudent.id_siswa}
                onChange={(e) => setNewStudent({ ...newStudent, id_siswa: e.target.value })}
                required
                placeholder="Contoh: 1234567890"
              />
            </div>
            <div className="form-group">
              <label>Nama Siswa</label>
              <input 
                type="text" 
                value={newStudent.nama_siswa}
                onChange={(e) => setNewStudent({ ...newStudent, nama_siswa: e.target.value })}
                required
                placeholder="Contoh: Slamet Kopling"
              />
            </div>
            <div className="form-group">
              <label>Tanggal Lahir</label>
              <input 
                type="date" 
                value={newStudent.tanggal_lahir}
                onChange={(e) => setNewStudent({ ...newStudent, tanggal_lahir: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Jenis Kelamin</label>
              <select 
                value={newStudent.jenis_kelamin} 
                onChange={(e) => setNewStudent({ ...newStudent, jenis_kelamin: e.target.value })}
              >
                <option value="L">Laki-Laki</option>
                <option value="P">Perempuan</option>
              </select>
            </div>
            <div className="form-group">
              <label>
                <i className="fas fa-calendar-alt mr-2 text-gray-500"></i>
                Tahun Ajaran Masuk
              </label>
              <input 
                type="text" 
                value={newStudent.tahun_ajaran_masuk}
                disabled
                placeholder="Otomatis dari tahun ajaran aktif"
                className="bg-gray-100 cursor-not-allowed"
              />
              <small className="text-gray-500 mt-1 block">
                {activeTASemester 
                  ? `Otomatis menggunakan tahun ajaran aktif: ${activeTASemester.tahun_ajaran} - ${activeTASemester.semester}`
                  : 'Memuat tahun ajaran aktif...'}
              </small>
            </div>
            <div className="md:col-span-2">
              <Button
                type="submit"
                variant="success"
                icon="plus"
                fullWidth
              >
                Tambah Siswa
              </Button>
            </div>
          </form>
      </FormSection>

      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
          <i className="fas fa-list mr-2 text-indigo-600"></i>
          Daftar Siswa
        </h2>
        
        {loading && <LoadingSpinner text="Memuat data siswa..." />}
        
        {error && (
          <StatusMessage type="error" message={`Error: ${error}`} autoClose={false} />
        )}
        
        {!loading && !error && (
          <div className="space-y-4">
            <Table
                columns={[
                  { 
                    key: 'id_siswa', 
                    label: 'NISN', 
                    sortable: true,
                    render: (value) => (
                      <span className="font-mono font-semibold text-gray-900">{value}</span>
                    )
                  },
                  { 
                    key: 'nama_siswa', 
                    label: 'Nama Siswa', 
                    sortable: true,
                    render: (value) => (
                      <span className="font-medium text-gray-900">{value}</span>
                    )
                  },
                  { 
                    key: 'tanggal_lahir', 
                    label: 'Tanggal Lahir', 
                    sortable: true,
                    render: (value) => (
                      <span className="text-gray-700">{value || '-'}</span>
                    )
                  },
                  { 
                    key: 'jenis_kelamin', 
                    label: 'Jenis Kelamin', 
                    sortable: true,
                    render: (value) => (
                      <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                        value === 'L' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-pink-100 text-pink-800'
                      }`}>
                        {value === 'L' ? '👨 Laki-Laki' : '👩 Perempuan'}
                      </span>
                    )
                  }
                ]}
                data={students.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)}
                emptyMessage="Belum ada siswa terdaftar"
                actions={(student) => (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      icon="edit"
                      onClick={() => handleEditClick(student)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      icon="trash-alt"
                      onClick={() => handleDeleteClick(student)}
                    >
                      Hapus
                    </Button>
                  </div>
                )}
            />

            {/* Pagination */}
            {students.length > itemsPerPage && (
              <div className="bg-white rounded-lg shadow p-4 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Halaman {currentPage} dari {Math.ceil(students.length / itemsPerPage)} 
                  ({(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, students.length)} dari {students.length})
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon="chevron-left"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    Sebelumnya
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon="chevron-right"
                    onClick={() => setCurrentPage(prev => Math.min(Math.ceil(students.length / itemsPerPage), prev + 1))}
                    disabled={currentPage === Math.ceil(students.length / itemsPerPage)}
                  >
                    Selanjutnya
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showEditModal && selectedStudent && (
        <EditStudentModal
          student={selectedStudent}
          onClose={() => setShowEditModal(false)}
          onSave={fetchStudents}
        />
      )}

      <ConfirmDialog
        isOpen={deleteConfirm.show}
        title="Hapus Siswa"
        message={`Apakah Anda yakin ingin menghapus siswa ${deleteConfirm.student?.nama_siswa} (NISN: ${deleteConfirm.student?.id_siswa})? Data yang sudah dihapus tidak dapat dikembalikan.`}
        confirmText="Ya, Hapus"
        cancelText="Batal"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm({ show: false, student: null })}
      />
    </ModuleContainer>
  );
};

export default StudentManagement;