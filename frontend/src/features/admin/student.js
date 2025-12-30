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

// --- Date helpers ---------------------------------------------------------
// Parse flexible date strings (DD-MM-YYYY, DD/MM/YYYY, DD-MM-YY, ISO, Excel serial) into ISO YYYY-MM-DD
const parseDateFlexible = (input) => {
  if (!input && input !== 0) return null;
  // If already YYYY-MM-DD
  const s = String(input).trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // DD-MM-YYYY or DD/MM/YYYY or DD-MM-YY or DD/MM/YY
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmy) {
    let day = dmy[1].padStart(2, '0');
    let month = dmy[2].padStart(2, '0');
    let year = dmy[3];
    if (year.length === 2) {
      const yy = parseInt(year, 10);
      year = (yy >= 70 ? 1900 + yy : 2000 + yy).toString();
    }
    return `${year}-${month}-${day}`;
  }

  // Excel serial number (as number)
  if (!isNaN(Number(s))) {
    const n = Number(s);
    // heuristic: if > 59 treat as Excel serial (dates after 1900)
    if (n > 59) {
      const date = new Date(Math.round((n - 25569) * 86400 * 1000));
      if (!isNaN(date)) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
    }
  }

  // Fallback: try Date.parse
  const parsed = Date.parse(s);
  if (!isNaN(parsed)) {
    const date = new Date(parsed);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return null;
};

// Format ISO or other inputs to display DD-MM-YYYY (for table)
const formatDateDisplay = (input) => {
  if (!input && input !== 0) return '-';
  const iso = parseDateFlexible(input);
  if (!iso) return String(input);
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return String(input);
  return `${m[3]}-${m[2]}-${m[1]}`; // DD-MM-YYYY
};

// Preprocess Excel file to normalize Tanggal Lahir to ISO YYYY-MM-DD when possible
const preprocessExcelFile = async (file) => {
  try {
    const XLSX = await import('xlsx');
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    // Find header row containing NISN and NAMA
    let headerRowIndex = -1;
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (Array.isArray(row) && row.length >= 2) {
        const hasNisn = row.some(cell => cell && String(cell).toUpperCase().includes('NIS'));
        const hasNama = row.some(cell => cell && String(cell).toUpperCase().includes('NAMA'));
        if (hasNisn && hasNama) { headerRowIndex = i; break; }
      }
    }
    if (headerRowIndex === -1) return file;

    const headers = data[headerRowIndex].map(h => h ? String(h).toUpperCase() : '');
    const tglIndex = headers.findIndex(h => h.includes('TANGGAL') || h.includes('LAHIR'));
    if (tglIndex === -1) return file;

    const rows = data.slice();
    for (let r = headerRowIndex + 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length === 0) continue;
      const cell = row[tglIndex];
      if (cell === undefined || cell === null || cell === '') continue;

      let dateStr = '';
      if (typeof cell === 'number') {
        const date = new Date(Math.round((cell - 25569) * 86400 * 1000));
        if (!isNaN(date)) dateStr = date.toISOString().slice(0, 10);
      } else if (cell instanceof Date) {
        dateStr = cell.toISOString().slice(0, 10);
      } else if (typeof cell === 'string') {
        const iso = parseDateFlexible(cell);
        if (iso) dateStr = iso;
        else {
          const parsed = Date.parse(cell);
          if (!isNaN(parsed)) dateStr = new Date(parsed).toISOString().slice(0, 10);
        }
      }

      if (dateStr) row[tglIndex] = dateStr;
    }

    const newSheet = XLSX.utils.aoa_to_sheet(rows);
    workbook.Sheets[sheetName] = newSheet;
    const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const newFile = new File([wbout], file.name, { type: file.type });
    return newFile;
  } catch (err) {
    console.warn('Preprocess Excel failed, uploading original file:', err?.message || err);
    return file;
  }
};

// Komponen Modal Edit Siswa
const EditStudentModal = ({ student, onClose, onSave, taSemesters = [], parseStartYear }) => {
  const [editedStudent, setEditedStudent] = useState({ ...student });
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize tahun_ajaran_masuk as single-year if available, or fallback to active TA start year
  useEffect(() => {
    if (student && student.tahun_ajaran_masuk) {
      const parsed = (student.tahun_ajaran_masuk || '').toString().match(/(\d{4})/);
      setEditedStudent(prev => ({ ...prev, tahun_ajaran_masuk: parsed ? parsed[1] : student.tahun_ajaran_masuk }));
    } else if (taSemesters && taSemesters.length > 0) {
      const active = taSemesters.find(t => t.is_aktif);
      const defaultYear = active ? parseStartYear(active.tahun_ajaran) : '';
      setEditedStudent(prev => ({ ...prev, tahun_ajaran_masuk: prev.tahun_ajaran_masuk || defaultYear }));
    }

    // Normalize tanggal_lahir for date input (ensure ISO YYYY-MM-DD)
    if (student && student.tanggal_lahir) {
      const iso = parseDateFlexible(student.tanggal_lahir) || student.tanggal_lahir;
      setEditedStudent(prev => ({ ...prev, tanggal_lahir: iso }));
    }
  }, [student, taSemesters, parseStartYear]);

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
        tanggal_lahir: parseDateFlexible(editedStudent.tanggal_lahir) || editedStudent.tanggal_lahir,
        jenis_kelamin: editedStudent.jenis_kelamin,
        // Store single-year format (e.g., '2024')
        tahun_ajaran_masuk: editedStudent.tahun_ajaran_masuk || null
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
              NIS - Tidak dapat diubah
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

          <div className="form-group">
            <label>
              <i className="fas fa-calendar-alt mr-2 text-gray-500"></i>
              Tahun Masuk (Year)
            </label>
            <select
              name="tahun_ajaran_masuk"
              value={editedStudent.tahun_ajaran_masuk || ''}
              onChange={(e) => handleChange(e)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">-- Pilih Tahun --</option>
              {Array.from(new Set(taSemesters.map(t => parseStartYear(t.tahun_ajaran)))).map(y => (
                y && <option key={`edit-year-${y}`} value={y}>{y}</option>
              ))}
            </select>
            <small className="text-gray-500 mt-1 block">Masukkan tahun tunggal, misal 2024</small>
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
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTASemester, setActiveTASemester] = useState(null);
  const [taSemesters, setTaSemesters] = useState([]);
  const [newStudent, setNewStudent] = useState({
    id_siswa: '',
    nama_siswa: '',
    tanggal_lahir: '',
    jenis_kelamin: 'L',
    tahun_ajaran_masuk: '' // will hold single-year like '2024'
  });

  // Helper: parse first 4-digit year from '2024/2025' or other formats
  const parseStartYear = (s) => {
    if (!s) return '';
    const m = String(s).match(/(\d{4})/);
    return m ? m[1] : '';
  };
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
      const taList = await adminApi.getTASemester();
      setTaSemesters(taList || []);

      const active = taList.find(ta => ta.is_aktif);
      if (active) {
        setActiveTASemester(active);
        // Auto-fill tahun_ajaran_masuk with active TA semester's START YEAR (e.g., '2024')
        setNewStudent(prev => ({
          ...prev,
          tahun_ajaran_masuk: parseStartYear(active.tahun_ajaran)
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

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

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
      const tanggalIso = parseDateFlexible(tanggal_lahir) || tanggal_lahir || null;
      const response = await adminApi.addStudent({ id_siswa, nama_siswa, tanggal_lahir: tanggalIso, jenis_kelamin, tahun_ajaran_masuk });
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
      // Preprocess Excel to normalize date columns (if possible)
      const processedFile = await preprocessExcelFile(file);
      const result = await adminApi.importStudents(processedFile);
      
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
            Download template, isi data siswa, lalu upload kembali untuk import massal.
          </p>
        </div>

        <h4 className="font-semibold text-gray-700 mb-3 mt-6">
          <i className="fas fa-keyboard mr-2"></i>
          Atau Tambah Manual:
        </h4>
        <form onSubmit={handleAddStudent} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-group">
              <label>NIS</label>
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
                Tahun Masuk (Year)
              </label>
              <select
                value={newStudent.tahun_ajaran_masuk}
                onChange={(e) => setNewStudent({ ...newStudent, tahun_ajaran_masuk: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                required
              >
                <option value="">Pilih Tahun Masuk</option>
                {Array.from(new Set(taSemesters.map(t => parseStartYear(t.tahun_ajaran)))).map(y => (
                  y && <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <small className="text-gray-500 mt-1 block">
                {activeTASemester 
                  ? `Default: ${parseStartYear(activeTASemester.tahun_ajaran)} (TA aktif: ${activeTASemester.tahun_ajaran})`
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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-800 flex items-center">
            <i className="fas fa-list mr-2 text-indigo-600"></i>
            Daftar Siswa
            <span className="ml-3 text-sm text-gray-500">({students.length} total)</span>
          </h2>

          {/* Search input */}
          <div className="w-full max-w-sm relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <i className="fas fa-search text-gray-400"></i>
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari NIS atau Nama..."
              className="pl-10 w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2 px-3 border transition-colors duration-200"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                title="Clear search"
              >
                <i className="fas fa-times"></i>
              </button>
            )}
          </div>
        </div>

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
                    label: 'NIS', 
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
                      <span className="text-gray-700">{formatDateDisplay(value)}</span>
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
                // Apply client-side search filter then paginate
            data={(
              students
                .filter(s => {
                  const q = searchTerm.trim().toLowerCase();
                  if (!q) return true;
                  return (s.id_siswa && String(s.id_siswa).toLowerCase().includes(q)) || (s.nama_siswa && s.nama_siswa.toLowerCase().includes(q));
                })
                .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
            )}
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
            { (students.filter(s => {
                  const q = searchTerm.trim().toLowerCase();
                  if (!q) return true;
                  return (s.id_siswa && String(s.id_siswa).toLowerCase().includes(q)) || (s.nama_siswa && s.nama_siswa.toLowerCase().includes(q));
                })).length > itemsPerPage && (
              <div className="bg-white rounded-lg shadow p-4 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Halaman {currentPage} dari {Math.ceil((students.filter(s => {
                    const q = searchTerm.trim().toLowerCase();
                    if (!q) return true;
                    return (s.id_siswa && String(s.id_siswa).toLowerCase().includes(q)) || (s.nama_siswa && s.nama_siswa.toLowerCase().includes(q));
                  })).length / itemsPerPage)} 
                  ({(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, (students.filter(s => {
                    const q = searchTerm.trim().toLowerCase();
                    if (!q) return true;
                    return (s.id_siswa && String(s.id_siswa).toLowerCase().includes(q)) || (s.nama_siswa && s.nama_siswa.toLowerCase().includes(q));
                  })).length)} dari {(students.filter(s => {
                    const q = searchTerm.trim().toLowerCase();
                    if (!q) return true;
                    return (s.id_siswa && String(s.id_siswa).toLowerCase().includes(q)) || (s.nama_siswa && s.nama_siswa.toLowerCase().includes(q));
                  })).length})
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
          taSemesters={taSemesters}
          parseStartYear={parseStartYear}
        />
      )}

      <ConfirmDialog
        isOpen={deleteConfirm.show}
        title="Hapus Siswa"
        message={`Apakah Anda yakin ingin menghapus siswa ${deleteConfirm.student?.nama_siswa} (NIS: ${deleteConfirm.student?.id_siswa})? Data yang sudah dihapus tidak dapat dikembalikan.`}
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