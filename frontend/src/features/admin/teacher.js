// frontend/src/features/admin/teacher.js
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

// Edit Teacher Modal
const EditTeacherModal = ({ teacher, onClose, onSave }) => {
  const [editedTeacher, setEditedTeacher] = useState({ ...teacher });
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditedTeacher(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setMessageType('');
    setIsSubmitting(true);

    try {
      const dataToUpdate = {
        username: editedTeacher.username,
        nama_guru: editedTeacher.nama_guru,
        email: editedTeacher.email,
        ...(editedTeacher.password && { password: editedTeacher.password })
      };
      
      const response = await adminApi.updateTeacher(editedTeacher.id_guru, dataToUpdate);
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
      <div className="modal-content animate-slideInUp max-w-lg">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <i className="fas fa-user-edit text-indigo-600"></i>
            Edit Guru: {teacher.nama_guru}
          </h3>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-2 transition-all"
          >
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        <StatusMessage type={messageType} message={message} />

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="form-group">
            <label>
              <i className="fas fa-id-badge mr-2 text-gray-500"></i>
              ID Guru - Tidak dapat diubah
            </label>
            <input 
              type="text" 
              value={editedTeacher.id_guru} 
              disabled 
              className="bg-gray-100 cursor-not-allowed"
            />
          </div>

          <div className="form-group">
            <label>
              <i className="fas fa-user mr-2 text-gray-500"></i>
              Username
            </label>
            <input
              type="text"
              name="username"
              value={editedTeacher.username}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>
              <i className="fas fa-chalkboard-teacher mr-2 text-gray-500"></i>
              Nama Lengkap
            </label>
            <input
              type="text"
              name="nama_guru"
              value={editedTeacher.nama_guru}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>
              <i className="fas fa-envelope mr-2 text-gray-500"></i>
              Email (Opsional)
            </label>
            <input
              type="email"
              name="email"
              value={editedTeacher.email || ''}
              onChange={handleChange}
              placeholder="contoh@email.com"
            />
          </div>

          <div className="form-group">
            <label>
              <i className="fas fa-lock mr-2 text-gray-500"></i>
              Password Baru (Kosongkan jika tidak ingin mengubah)
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={editedTeacher.password || ''}
                onChange={handleChange}
                placeholder="Masukkan password baru"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-indigo-600"
              >
                <i className={`fas fa-${showPassword ? 'eye-slash' : 'eye'}`}></i>
              </button>
            </div>
          </div>

          <div className="modal-actions">
            <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
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

// Main Component
const GuruManagement = () => {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, teacher: null });
  const [showPassword, setShowPassword] = useState(false);
  const [newTeacher, setNewTeacher] = useState({
    id_guru: '',
    username: '',
    password: '',
    nama_guru: '',
    email: ''
  });

  useEffect(() => {
    fetchTeachers();
  }, []);

  const itemsPerPage = 20;

  const fetchTeachers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.getTeachers();
      setTeachers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (text, type = 'success') => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => {
      setMessage('');
      setMessageType('');
    }, 5000);
  };

  const handleAddTeacher = async (e) => {
    e.preventDefault();
    setMessage('');
    setMessageType('');

    if (!newTeacher.id_guru.trim() || !newTeacher.username.trim() || !newTeacher.password.trim()) {
      showMessage('ID Guru, Username, dan Password harus diisi!', 'error');
      return;
    }

    try {
      const response = await adminApi.addTeacher(newTeacher);
      showMessage(response.message);
      setNewTeacher({
        id_guru: '',
        username: '',
        password: '',
        nama_guru: '',
        email: ''
      });
      fetchTeachers();
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  const handleEditClick = (teacher) => {
    setSelectedTeacher(teacher);
    setShowEditModal(true);
  };

  const handleDeleteClick = (teacher) => {
    setDeleteConfirm({ show: true, teacher });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm.teacher) return;

    try {
      const response = await adminApi.deleteTeacher(deleteConfirm.teacher.id_guru);
      showMessage(response.message);
      fetchTeachers();
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setDeleteConfirm({ show: false, teacher: null });
    }
  };

  return (
    <ModuleContainer>
      <PageHeader
        icon="chalkboard-teacher"
        title="Manajemen Guru"
        subtitle="Kelola data guru, tambah guru baru, dan update informasi guru"
        badge={`${teachers.length} Guru`}
      />

      <StatusMessage
        type={messageType}
        message={message}
        onClose={() => setMessage('')}
      />

      <FormSection title="Tambah Guru Baru" icon="user-plus" variant="success">
        <form onSubmit={handleAddTeacher} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="form-group">
            <label>ID Guru (NIP)</label>
            <input
              type="text"
              value={newTeacher.id_guru}
              onChange={(e) => setNewTeacher({ ...newTeacher, id_guru: e.target.value })}
              required
              placeholder="Contoh: 198501012010011001"
            />
          </div>

          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              value={newTeacher.username}
              onChange={(e) => setNewTeacher({ ...newTeacher, username: e.target.value })}
              required
              placeholder="Username untuk login"
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={newTeacher.password}
                onChange={(e) => setNewTeacher({ ...newTeacher, password: e.target.value })}
                required
                placeholder="Password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-indigo-600"
              >
                <i className={`fas fa-${showPassword ? 'eye-slash' : 'eye'}`}></i>
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>Nama Lengkap</label>
            <input
              type="text"
              value={newTeacher.nama_guru}
              onChange={(e) => setNewTeacher({ ...newTeacher, nama_guru: e.target.value })}
              required
              placeholder="Nama lengkap guru"
            />
          </div>

          <div className="form-group md:col-span-2">
            <label>Email (Opsional)</label>
            <input
              type="email"
              value={newTeacher.email}
              onChange={(e) => setNewTeacher({ ...newTeacher, email: e.target.value })}
              placeholder="contoh@email.com"
            />
          </div>

          <div className="md:col-span-2">
            <Button type="submit" variant="success" icon="plus" fullWidth>
              Tambah Guru
            </Button>
          </div>
        </form>
      </FormSection>

      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
          <i className="fas fa-list mr-2 text-indigo-600"></i>
          Daftar Guru
          <span className="ml-auto text-sm font-normal text-gray-500">
            Total: {teachers.length}
          </span>
        </h2>

        {loading && <LoadingSpinner text="Memuat data guru..." />}
        {error && <StatusMessage type="error" message={`Error: ${error}`} autoClose={false} />}

        {!loading && !error && (
          <div className="space-y-4">
            <Table
              columns={[
                {
                  key: 'id_guru',
                  label: 'NIP',
                  sortable: true,
                  render: (value) => (
                    <span className="font-mono font-semibold text-gray-900">{value}</span>
                  )
                },
                {
                  key: 'username',
                  label: 'Username',
                  sortable: true,
                  render: (value) => (
                    <span className="font-medium text-gray-900">{value}</span>
                  )
                },
                {
                  key: 'nama_guru',
                  label: 'Nama Guru',
                  sortable: true,
                  render: (value) => (
                    <span className="font-medium text-gray-900">{value}</span>
                  )
                },
                {
                  key: 'email',
                  label: 'Email',
                  sortable: true,
                  render: (value) => (
                    <span className="text-gray-700">{value || '-'}</span>
                  )
                }
              ]}
              data={teachers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)}
              emptyMessage="Belum ada guru terdaftar"
              actions={(teacher) => (
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    icon="edit"
                    onClick={() => handleEditClick(teacher)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    icon="trash-alt"
                    onClick={() => handleDeleteClick(teacher)}
                  >
                    Hapus
                  </Button>
                </div>
              )}
            />

            {/* Pagination */}
            {teachers.length > itemsPerPage && (
              <div className="bg-white rounded-lg shadow p-4 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Halaman {currentPage} dari {Math.ceil(teachers.length / itemsPerPage)} 
                  ({(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, teachers.length)} dari {teachers.length})
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
                    onClick={() => setCurrentPage(prev => Math.min(Math.ceil(teachers.length / itemsPerPage), prev + 1))}
                    disabled={currentPage === Math.ceil(teachers.length / itemsPerPage)}
                  >
                    Selanjutnya
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showEditModal && selectedTeacher && (
        <EditTeacherModal
          teacher={selectedTeacher}
          onClose={() => setShowEditModal(false)}
          onSave={fetchTeachers}
        />
      )}

      <ConfirmDialog
        show={deleteConfirm.show}
        title="Hapus Guru"
        message={`Apakah Anda yakin ingin menghapus guru ${deleteConfirm.teacher?.nama_guru} (NIP: ${deleteConfirm.teacher?.id_guru})? Data yang sudah dihapus tidak dapat dikembalikan.`}
        confirmText="Ya, Hapus"
        cancelText="Batal"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm({ show: false, teacher: null })}
      />
    </ModuleContainer>
  );
};

export default GuruManagement;
