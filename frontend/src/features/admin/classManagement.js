// frontend/src/features/admin/classManagement.js
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

// Edit Kelas Modal
const EditKelasModal = ({ kelas, onClose, onSave, teachers }) => {
  const [editedKelas, setEditedKelas] = useState({ ...kelas });
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditedKelas(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setMessageType('');
    setIsSubmitting(true);

    try {
      const dataToUpdate = {
        nama_kelas: editedKelas.nama_kelas,
        id_wali_kelas: editedKelas.id_wali_kelas || null,
      };
      
      const response = await adminApi.updateKelas(editedKelas.id_kelas, dataToUpdate);
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
            <i className="fas fa-edit text-indigo-600"></i>
            Edit Kelas: {kelas.nama_kelas}
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
              ID Kelas - Tidak dapat diubah
            </label>
            <input 
              type="text" 
              value={editedKelas.id_kelas} 
              disabled 
              className="bg-gray-100 cursor-not-allowed"
            />
          </div>

          <div className="form-group">
            <label>
              <i className="fas fa-chalkboard mr-2 text-gray-500"></i>
              Nama Kelas
            </label>
            <input
              type="text"
              name="nama_kelas"
              value={editedKelas.nama_kelas}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>
              <i className="fas fa-user-tie mr-2 text-gray-500"></i>
              Wali Kelas (Opsional)
            </label>
            <select
              name="id_wali_kelas"
              value={editedKelas.id_wali_kelas || ''}
              onChange={handleChange}
            >
              <option value="">Pilih Wali Kelas</option>
              {teachers.map(teacher => (
                <option key={teacher.id_guru} value={teacher.id_guru}>
                  {teacher.nama_guru}
                </option>
              ))}
            </select>
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
const KelasManagement = ({ activeTASemester }) => {
  const [kelas, setKelas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newKelasName, setNewKelasName] = useState('');
  const [teachers, setTeachers] = useState([]);
  const [selectedWaliKelas, setSelectedWaliKelas] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedKelas, setSelectedKelas] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, kelas: null });
  const [searchTerm, setSearchTerm] = useState('');

  const fetchKelasAndTeachers = async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTASemester) {
        const kelasData = await adminApi.getKelas(activeTASemester.id_ta_semester);
        setKelas(kelasData);
      } else {
        setKelas([]);
      }
      const teachersData = await adminApi.getTeachers();
      setTeachers(teachersData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKelasAndTeachers();
  }, [activeTASemester]);

  const showMessage = (text, type = 'success') => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => {
      setMessage('');
      setMessageType('');
    }, 5000);
  };

  const handleAddKelas = async (e) => {
    e.preventDefault();
    setMessage('');
    setMessageType('');
    
    if (!activeTASemester) {
      showMessage('Harap atur Tahun Ajaran & Semester aktif terlebih dahulu.', 'error');
      return;
    }

    const waliKelasId = selectedWaliKelas ? parseInt(selectedWaliKelas) : null;

    try {
      const response = await adminApi.addKelas({
        nama_kelas: newKelasName,
        id_wali_kelas: waliKelasId,
        id_ta_semester: activeTASemester.id_ta_semester
      });
      showMessage(response.message);
      setNewKelasName('');
      setSelectedWaliKelas('');
      fetchKelasAndTeachers();
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  const handleEditClick = (kelas) => {
    setSelectedKelas(kelas);
    setShowEditModal(true);
  };

  const handleDeleteClick = (kelas) => {
    setDeleteConfirm({ show: true, kelas });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm.kelas) return;

    try {
      const response = await adminApi.deleteKelas(deleteConfirm.kelas.id_kelas);
      showMessage(response.message);
      fetchKelasAndTeachers();
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setDeleteConfirm({ show: false, kelas: null });
    }
  };

  const filteredKelas = kelas.filter(k => {
    const matchesSearch = k.nama_kelas.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (k.wali_kelas && k.wali_kelas.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesSearch;
  });

  const totalClasses = kelas.length;
  const classesWithTeachers = kelas.filter(k => k.wali_kelas).length;
  const classesWithoutTeachers = totalClasses - classesWithTeachers;

  return (
    <ModuleContainer>
      <PageHeader
        icon="chalkboard-teacher"
        title="Manajemen Kelas"
        subtitle="Kelola kelas dan wali kelas untuk setiap tahun ajaran"
        badge={`${totalClasses} Kelas`}
      />

      <StatusMessage
        type={messageType}
        message={message}
        onClose={() => setMessage('')}
      />

      {activeTASemester ? (
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-500 p-3 rounded-full">
              <i className="fas fa-calendar-alt text-white text-xl"></i>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800">Tahun Ajaran Aktif</h3>
              <p className="text-indigo-600 font-medium">
                {activeTASemester.tahun_ajaran} - {activeTASemester.semester}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <StatusMessage
          type="warning"
          message="Harap atur Tahun Ajaran & Semester aktif terlebih dahulu."
          autoClose={false}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">Total Kelas</p>
              <p className="text-3xl font-bold">{totalClasses}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-full">
              <i className="fas fa-school text-2xl"></i>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm">Dengan Wali Kelas</p>
              <p className="text-3xl font-bold">{classesWithTeachers}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-full">
              <i className="fas fa-user-tie text-2xl"></i>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm">Tanpa Wali Kelas</p>
              <p className="text-3xl font-bold">{classesWithoutTeachers}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-full">
              <i className="fas fa-exclamation-circle text-2xl"></i>
            </div>
          </div>
        </div>
      </div>

      <FormSection title="Tambah Kelas Baru" icon="plus-circle" variant="success">
        <form onSubmit={handleAddKelas} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="form-group">
            <label>Nama Kelas</label>
            <input
              type="text"
              value={newKelasName}
              onChange={(e) => setNewKelasName(e.target.value)}
              required
              placeholder="Contoh: 10 IPA 1"
            />
          </div>

          <div className="form-group">
            <label>Wali Kelas (Opsional)</label>
            <select 
              value={selectedWaliKelas} 
              onChange={(e) => setSelectedWaliKelas(e.target.value)}
            >
              <option value="">Pilih Wali Kelas</option>
              {teachers.map(teacher => (
                <option key={teacher.id_guru} value={teacher.id_guru}>
                  {teacher.nama_guru}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <Button 
              type="submit" 
              variant="success" 
              icon="plus"
              disabled={!activeTASemester}
              fullWidth
            >
              Tambah Kelas
            </Button>
          </div>
        </form>
      </FormSection>

      <div className="mb-4">
        <div className="relative">
          <input 
            type="text" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari kelas atau wali kelas..." 
            className="form-control pl-10"
          />
          <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
          <i className="fas fa-list mr-2 text-indigo-600"></i>
          Daftar Kelas
        </h2>

        {loading && <LoadingSpinner text="Memuat data kelas..." />}
        {error && <StatusMessage type="error" message={`Error: ${error}`} autoClose={false} />}

        {!loading && !error && (
          <>
            {filteredKelas.length > 0 ? (
              <Table
                columns={[
                  {
                    key: 'id_kelas',
                    label: 'ID',
                    sortable: true,
                    render: (value) => (
                      <span className="font-mono font-semibold text-gray-900">{value}</span>
                    )
                  },
                  {
                    key: 'nama_kelas',
                    label: 'Nama Kelas',
                    sortable: true,
                    render: (value) => (
                      <span className="font-semibold text-gray-900">{value}</span>
                    )
                  },
                  {
                    key: 'wali_kelas',
                    label: 'Wali Kelas',
                    sortable: true,
                    render: (value) => 
                      value ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <i className="fas fa-user-tie mr-1"></i> {value}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          <i className="fas fa-exclamation-circle mr-1"></i> Belum ditentukan
                        </span>
                      )
                  },
                  {
                    key: 'tahun_ajaran',
                    label: 'Tahun Ajaran',
                    sortable: true
                  },
                  {
                    key: 'semester',
                    label: 'Semester',
                    sortable: true,
                    render: (value) => (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        {value}
                      </span>
                    )
                  }
                ]}
                data={filteredKelas}
                emptyMessage="Belum ada kelas terdaftar"
                actions={(k) => (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      icon="edit"
                      onClick={() => handleEditClick(k)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      icon="trash-alt"
                      onClick={() => handleDeleteClick(k)}
                    >
                      Hapus
                    </Button>
                  </div>
                )}
              />
            ) : (
              <EmptyState
                icon="school"
                title={searchTerm ? 'Tidak Ada Hasil' : 'Belum Ada Kelas'}
                description={
                  searchTerm 
                    ? `Tidak ada kelas yang cocok dengan pencarian "${searchTerm}".`
                    : 'Belum ada kelas terdaftar untuk tahun ajaran aktif.'
                }
              />
            )}
          </>
        )}
      </div>

      {showEditModal && selectedKelas && (
        <EditKelasModal
          kelas={selectedKelas}
          onClose={() => setShowEditModal(false)}
          onSave={fetchKelasAndTeachers}
          teachers={teachers}
        />
      )}

      <ConfirmDialog
        isOpen={deleteConfirm.show}
        title="Hapus Kelas"
        message={`Apakah Anda yakin ingin menghapus kelas ${deleteConfirm.kelas?.nama_kelas} (ID: ${deleteConfirm.kelas?.id_kelas})? Data yang sudah dihapus tidak dapat dikembalikan.`}
        confirmText="Ya, Hapus"
        cancelText="Batal"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm({ show: false, kelas: null })}
      />
    </ModuleContainer>
  );
};

export default KelasManagement;
