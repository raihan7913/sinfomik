// frontend/src/features/admin/TASemester.js
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

const TASemesterManagement = ({ activeTASemester, setActiveTASemester }) => {
  const [taSemesters, setTASemesters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [newTahunAjaran, setNewTahunAjaran] = useState('');
  const [newSemester, setNewSemester] = useState('Ganjil');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Ya, Konfirmasi',
    variant: 'info',
    onConfirm: null
  });

  const itemsPerPage = 20;

  const fetchTASemesters = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.getTASemester();
      setTASemesters(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTASemesters();
  }, []);

  const handleAddTASemester = async (e) => {
    e.preventDefault();
    setMessage('');
    setMessageType('');
    
    if (!newTahunAjaran.trim()) {
      setMessage('Tahun Ajaran harus diisi');
      setMessageType('error');
      return;
    }
    
    try {
      const response = await adminApi.addTASemester(newTahunAjaran, newSemester);
      setMessage(response.message);
      setMessageType('success');
      setNewTahunAjaran('');
      setNewSemester('Ganjil');
      fetchTASemesters(); // Refresh daftar
      
      // Hide message after 5 seconds
      setTimeout(() => {
        setMessage('');
        setMessageType('');
      }, 5000);
    } catch (err) {
      setMessage(err.message);
      setMessageType('error');
    }
  };

  const handleSetActive = async (id) => {
    const selectedTA = taSemesters.find(ta => ta.id_ta_semester === id);
    setConfirmDialog({
      isOpen: true,
      title: 'Konfirmasi Aktivasi',
      message: `Apakah Anda yakin ingin mengaktifkan "${selectedTA.tahun_ajaran} - ${selectedTA.semester}"? Tahun ajaran yang aktif saat ini akan dinonaktifkan.`,
      confirmText: 'Ya, Aktifkan',
      variant: 'info',
      onConfirm: async () => {
        setMessage('');
        setMessageType('');
        try {
          const response = await adminApi.setActiveTASemester(id);
          setMessage(response.message);
          setMessageType('success');
          // Update activeTASemester state in parent (AdminDashboardContent)
          const updatedActive = taSemesters.find(ta => ta.id_ta_semester === id);
          setActiveTASemester(updatedActive || null);
          fetchTASemesters(); // Refresh daftar untuk update status aktif
          
          // Hide message after 5 seconds
          setTimeout(() => {
            setMessage('');
            setMessageType('');
          }, 5000);
        } catch (err) {
          setMessage(err.message);
          setMessageType('error');
        }
        setConfirmDialog({ ...confirmDialog, isOpen: false });
      }
    });
  };

  const handleDeleteTASemester = async (id) => {
    const selectedTA = taSemesters.find(ta => ta.id_ta_semester === id);
    setConfirmDialog({
      isOpen: true,
      title: 'Hapus Tahun Ajaran & Semester',
      message: `Apakah Anda yakin akan menghapus tahun ajaran terkait? Semua data yang berhubungan dengan tahun ajaran tersebut akan di hapus secara permanen.\n\n"${selectedTA.tahun_ajaran} - ${selectedTA.semester}"`,
      confirmText: 'Ya, Hapus',
      variant: 'danger',
      onConfirm: async () => {
        setMessage('');
        setMessageType('');
        try {
          const response = await adminApi.deleteTASemester(id);
          setMessage(response.message);
          setMessageType('success');
          fetchTASemesters(); // Refresh daftar
          
          // Hide message after 5 seconds
          setTimeout(() => {
            setMessage('');
            setMessageType('');
          }, 5000);
        } catch (err) {
          setMessage(err.message);
          setMessageType('error');
        }
        setConfirmDialog({ ...confirmDialog, isOpen: false });
      }
    });
  };

  // Tidak perlu columns, kita akan render tabel manual untuk kontrol lebih baik

  return (
    <ModuleContainer>
      <PageHeader
        icon="calendar-alt"
        title="Manajemen Tahun Ajaran & Semester"
        badge={activeTASemester ? `Aktif: ${activeTASemester.tahun_ajaran} - ${activeTASemester.semester}` : 'Tidak ada yang aktif'}
        badgeColor="blue"
      />

      <StatusMessage message={message} type={messageType} />

      <FormSection title="Tambah Tahun Ajaran & Semester Baru" icon="plus-circle">
        <form onSubmit={handleAddTASemester} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tahun Ajaran</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <i className="fas fa-calendar text-gray-400"></i>
                </div>
                <input 
                  type="text" 
                  value={newTahunAjaran}
                  onChange={(e) => setNewTahunAjaran(e.target.value)}
                  className="pl-10 w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2 px-3 border transition-colors duration-200" 
                  placeholder="Contoh: 2024/2025" 
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <i className="fas fa-book text-gray-400"></i>
                </div>
                <select 
                  value={newSemester} 
                  onChange={(e) => setNewSemester(e.target.value)}
                  className="pl-10 w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2 px-3 border transition-colors duration-200"
                >
                  <option value="Ganjil">Ganjil</option>
                  <option value="Genap">Genap</option>
                </select>
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button type="submit" variant="primary" icon="save">
              Tambah
            </Button>
          </div>
        </form>
      </FormSection>

      {loading && <LoadingSpinner text="Memuat data tahun ajaran..." />}

      {error && (
        <StatusMessage 
          message={`Error: ${error}`} 
          type="error" 
        />
      )}

      {!loading && !error && taSemesters.length === 0 && (
        <EmptyState
          icon="calendar-times"
          message="Belum ada Tahun Ajaran & Semester yang terdaftar."
        />
      )}

      {!loading && !error && taSemesters.length > 0 && (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h4 className="text-lg font-semibold text-gray-700 flex items-center">
              <i className="fas fa-list-alt mr-2 text-purple-500"></i>
              Daftar Tahun Ajaran & Semester
              <span className="ml-auto text-sm font-normal text-gray-500">
                Total: {taSemesters.length}
              </span>
            </h4>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tahun Ajaran</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Semester</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {taSemesters.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((row, index) => (
                  <tr key={row.id_ta_semester} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.id_ta_semester}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{row.tahun_ajaran}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.semester}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        row.is_aktif 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {row.is_aktif ? 'Aktif' : 'Tidak Aktif'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {!row.is_aktif && (
                        <div className="flex gap-2">
                          <Button
                            variant="primary"
                            size="sm"
                            icon="check-circle"
                            onClick={() => handleSetActive(row.id_ta_semester)}
                          >
                            Set Aktif
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            icon="trash-alt"
                            onClick={() => handleDeleteTASemester(row.id_ta_semester)}
                          >
                            Hapus
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          {taSemesters.length > itemsPerPage && (
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Halaman {currentPage} dari {Math.ceil(taSemesters.length / itemsPerPage)} 
                ({(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, taSemesters.length)} dari {taSemesters.length})
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
                  onClick={() => setCurrentPage(prev => Math.min(Math.ceil(taSemesters.length / itemsPerPage), prev + 1))}
                  disabled={currentPage === Math.ceil(taSemesters.length / itemsPerPage)}
                >
                  Selanjutnya
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        cancelText="Batal"
        variant={confirmDialog.variant}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
      />
    </ModuleContainer>
  );
};

export default TASemesterManagement;