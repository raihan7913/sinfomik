// Import ini harus di bagian paling atas file
import { getTipeNilai, getMataPelajaran } from './admin'; // getMataPelajaran juga dibutuhkan
export { getTipeNilai, getMataPelajaran }; // Ekspor ulang agar bisa digunakan oleh modul lain

// frontend/src/api/guru.js
import { API_BASE_URL } from '../config/apiConfig';

// --- API untuk Tahun Ajaran & Semester (Read-only for Guru) ---
export const getTASemester = async () => {
  return fetchData(`${API_BASE_URL}/api/guru/ta-semester`);
};

// --- API untuk Change Password Guru ---
export const changePassword = async (oldPassword, newPassword) => {
  // Fungsi khusus yang TIDAK redirect saat 401 (password salah)
  try {
    const token = localStorage.getItem('token');
    
    const response = await fetch(`${API_BASE_URL}/api/guru/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ oldPassword, newPassword })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      // Jangan redirect, lempar error dengan message dari backend
      throw new Error(data.message || 'Gagal mengubah password');
    }
    
    return data;
  } catch (error) {
    console.error('Error changing password:', error);
    throw error;
  }
};

// --- Fungsi Umum untuk Panggilan API dengan JWT Authentication ---
const fetchData = async (url, options = {}) => {
  try {
    // Get JWT token from localStorage
    const token = localStorage.getItem('token');
    
    // Add Authorization header if token exists
    const headers = {
      ...options.headers,
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Only add Content-Type if not sending FormData
    if (options.body && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }
    
    const response = await fetch(url, {
      ...options,
      headers
    });
    
    // Handle 401 Unauthorized - token expired or invalid
    if (response.status === 401) {
      console.log('🔒 Token expired or invalid, redirecting to login (guarded)...');
      const now = Date.now();
      const last = window.__lastAuthRedirect || 0;
      if (now - last > 5000) {
        window.__lastAuthRedirect = now;
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.replace('/login');
      }
      throw new Error('Session expired');
    }
    if (response.status === 429) {
      const data429 = await response.json().catch(()=>({}));
      throw new Error(data429.message || 'Rate limit exceeded. Please wait.');
    }
    
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Terjadi kesalahan pada server.');
    }
    return data;
  } catch (error) {
    console.error(`Error fetching from ${url}:`, error);
    throw error;
  }
};

// --- API untuk Penugasan Guru (Kelas & Mapel yang Diajar) ---
export const getGuruAssignments = async (id_guru, id_ta_semester) => {
  if (!id_guru || !id_ta_semester) {
    throw new Error("ID Guru dan ID TA/Semester diperlukan untuk mengambil penugasan.");
  }
  return fetchData(`${API_BASE_URL}/api/guru/assignments/${id_guru}/${id_ta_semester}`);
};

// --- API untuk Siswa di Kelas Tertentu ---
export const getStudentsInClass = async (id_kelas, id_ta_semester) => {
  if (!id_kelas || !id_ta_semester) {
    throw new Error("ID Kelas dan ID TA/Semester diperlukan untuk mengambil siswa.");
  }
  return fetchData(`${API_BASE_URL}/api/guru/students-in-class/${id_kelas}/${id_ta_semester}`);
};

// --- API untuk Menambah/Memperbarui Nilai (Original) ---
export const addOrUpdateGrade = async (gradeData) => {
  return fetchData(`${API_BASE_URL}/api/guru/grades`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(gradeData),
  });
};

// --- API untuk Menambah/Memperbarui Nilai (New TP/UAS Structure) ---
export const addOrUpdateNewGrade = async (gradeData) => {
  return fetchData(`${API_BASE_URL}/api/guru/grades-new`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(gradeData),
  });
};

// --- API untuk Mendapatkan Nilai berdasarkan Assignment ---
export const getGradesByAssignment = async (id_guru, id_mapel, id_kelas, id_ta_semester) => {
  if (!id_guru || !id_mapel || !id_kelas || !id_ta_semester) {
    throw new Error("Semua ID diperlukan untuk mengambil nilai berdasarkan assignment.");
  }
  return fetchData(`${API_BASE_URL}/api/guru/grades/assignment/${id_guru}/${id_mapel}/${id_kelas}/${id_ta_semester}`);
};

// --- API untuk Rekap Nilai ---
export const getRekapNilai = async (id_guru, id_mapel, id_kelas, id_ta_semester) => {
  if (!id_guru || !id_mapel || !id_kelas || !id_ta_semester) {
    throw new Error("Semua ID diperlukan untuk mengambil rekap nilai.");
  }
  return fetchData(`${API_BASE_URL}/api/guru/grades/rekap/${id_guru}/${id_mapel}/${id_kelas}/${id_ta_semester}`);
};

// --- API Capaian Pembelajaran untuk Guru ---
export const getCapaianPembelajaranByMapel = async (id_mapel) => {
  if (!id_mapel) {
    throw new Error("ID Mata Pelajaran diperlukan untuk mengambil Capaian Pembelajaran.");
  }
  return fetchData(`${API_BASE_URL}/api/guru/cp/mapel/${id_mapel}`);
};

export const getSiswaCapaianPembelajaran = async (id_guru, id_mapel, id_kelas, id_ta_semester) => {
  if (!id_guru || !id_mapel || !id_kelas || !id_ta_semester) {
    throw new Error("Semua ID diperlukan untuk mengambil Siswa Capaian Pembelajaran.");
  }
  return fetchData(`${API_BASE_URL}/api/guru/siswa-cp/${id_guru}/${id_mapel}/${id_kelas}/${id_ta_semester}`);
};

export const addOrUpdateSiswaCapaianPembelajaran = async (siswaCpData) => {
  return fetchData(`${API_BASE_URL}/api/guru/siswa-cp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(siswaCpData),
  });
};

// --- New: Get Wali Kelas Grades ---
export const getWaliKelasGrades = async (id_guru, id_ta_semester, id_kelas = null) => {
  if (!id_guru || !id_ta_semester) {
    throw new Error("ID Guru dan ID TA/Semester diperlukan untuk mengambil nilai kelas wali.");
  }
  let url = `${API_BASE_URL}/api/guru/wali-kelas-grades/${id_guru}/${id_ta_semester}`;
  if (id_kelas) {
    url += `?id_kelas=${id_kelas}`;
  }
  return fetchData(url);
};

// --- New: Get Wali Kelas Class List ---
export const getWaliKelasClassList = async (id_guru, id_ta_semester) => {
  if (!id_guru || !id_ta_semester) {
    throw new Error("ID Guru dan ID TA/Semester diperlukan untuk mengambil daftar kelas wali.");
  }
  return fetchData(`${API_BASE_URL}/api/guru/wali-kelas-class-list/${id_guru}/${id_ta_semester}`);
};

// --- New: Get TP (Tujuan Pembelajaran) by Mapel, Fase, and Kelas ---
export const getTpByMapelFaseKelas = async (id_mapel, fase, id_kelas, semester = null) => {
  if (!id_mapel || !fase || !id_kelas) {
    throw new Error("ID Mapel, Fase, dan ID Kelas diperlukan untuk mengambil TP.");
  }
  
  // Build URL with optional semester parameter
  let url = `${API_BASE_URL}/api/excel/tp/${id_mapel}/${fase}/${id_kelas}`;
  if (semester) {
    url += `?semester=${semester}`;
  }
  
  return fetchData(url);
};

// --- New: Export Excel Template for Grades ---
export const exportGradeTemplate = async (id_guru, id_mapel, id_kelas, id_ta_semester) => {
  if (!id_guru || !id_mapel || !id_kelas || !id_ta_semester) {
    throw new Error("Semua ID diperlukan untuk export template.");
  }
  
  try {
    // Get JWT token from localStorage
    const token = localStorage.getItem('token');
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(
      `${API_BASE_URL}/api/grades/export-template/${id_guru}/${id_mapel}/${id_kelas}/${id_ta_semester}`,
      { headers }
    );
    
    // Handle 401 Unauthorized with redirect guard
    if (response.status === 401) {
      console.log('🔒 Token expired or invalid, redirecting to login (guarded)...');
      const now = Date.now();
      const last = window.__lastAuthRedirect || 0;
      if (now - last > 5000) {
        window.__lastAuthRedirect = now;
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.replace('/login');
      }
      throw new Error('Session expired');
    }
    
    if (response.status === 429) {
      const data429 = await response.json().catch(()=>({}));
      throw new Error(data429.message || 'Rate limit exceeded. Please wait.');
    }
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Gagal export template');
    }
    
    // Get filename from Content-Disposition header or create default
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = 'Template_Nilai.xlsx';
    if (contentDisposition) {
      // Try multiple regex patterns to extract filename
      let filenameMatch = contentDisposition.match(/filename="([^"]+)"/i);
      if (!filenameMatch) {
        filenameMatch = contentDisposition.match(/filename=([^;]+)/i);
      }
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1].trim();
      }
    }
    
    console.log('Content-Disposition:', contentDisposition);
    console.log('Extracted filename:', filename);
    
    // Convert to blob and download
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    return { success: true, message: 'Template berhasil diunduh' };
  } catch (error) {
    console.error('Error exporting template:', error);
    throw error;
  }
};

// --- New: Import Grades from Excel ---
export const importGradesFromExcel = async (file, id_guru, id_mapel, id_kelas, id_ta_semester) => {
  if (!file || !id_guru || !id_mapel || !id_kelas || !id_ta_semester) {
    throw new Error("File dan semua ID diperlukan untuk import nilai.");
  }
  
  const formData = new FormData();
  formData.append('file', file);
  formData.append('id_guru', id_guru);
  formData.append('id_mapel', id_mapel);
  formData.append('id_kelas', id_kelas);
  formData.append('id_ta_semester', id_ta_semester);
  
  return fetchData(`${API_BASE_URL}/api/grades/import-from-excel`, {
    method: 'POST',
    body: formData,
  });
};

// --- New: Save KKM Settings ---
export const saveKkmSettings = async (id_guru, id_mapel, id_kelas, id_ta_semester, kkmSettings) => {
  if (!id_guru || !id_mapel || !id_kelas || !id_ta_semester || !kkmSettings) {
    throw new Error("Semua parameter diperlukan untuk menyimpan KKM.");
  }
  
  return fetchData(`${API_BASE_URL}/api/kkm/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id_guru,
      id_mapel,
      id_kelas,
      id_ta_semester,
      kkmSettings
    }),
  });
};

// --- New: Get KKM Settings ---
export const getKkmSettings = async (id_guru, id_mapel, id_kelas, id_ta_semester) => {
  if (!id_guru || !id_mapel || !id_kelas || !id_ta_semester) {
    throw new Error("Semua ID diperlukan untuk mengambil KKM.");
  }
  
  return fetchData(`${API_BASE_URL}/api/kkm/${id_guru}/${id_mapel}/${id_kelas}/${id_ta_semester}`);
};

// --- New: Export Final Grades to Excel ---
export const exportFinalGrades = async (id_guru, id_mapel, id_kelas, id_ta_semester) => {
  if (!id_guru || !id_mapel || !id_kelas || !id_ta_semester) {
    throw new Error("Semua ID diperlukan untuk export nilai final.");
  }
  
  try {
    // Get JWT token from localStorage
    const token = localStorage.getItem('token');
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(
      `${API_BASE_URL}/api/grades/export/${id_guru}/${id_mapel}/${id_kelas}/${id_ta_semester}`,
      { headers }
    );
    
    // Handle 401 Unauthorized with redirect guard
    if (response.status === 401) {
      console.log('🔒 Token expired or invalid, redirecting to login (guarded)...');
      const now = Date.now();
      const last = window.__lastAuthRedirect || 0;
      if (now - last > 5000) {
        window.__lastAuthRedirect = now;
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.replace('/login');
      }
      throw new Error('Session expired');
    }
    
    if (response.status === 429) {
      const data429 = await response.json().catch(()=>({}));
      throw new Error(data429.message || 'Rate limit exceeded. Please wait.');
    }
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Gagal export nilai');
    }
    
    // Get filename from Content-Disposition header
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = 'Nilai_Final.xlsx';
    if (contentDisposition) {
      let filenameMatch = contentDisposition.match(/filename="([^"]+)"/i);
      if (!filenameMatch) {
        filenameMatch = contentDisposition.match(/filename=([^;]+)/i);
      }
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1].trim();
      }
    }
    
    console.log('Export Final - Content-Disposition:', contentDisposition);
    console.log('Export Final - Extracted filename:', filename);
    
    // Convert to blob and download
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    return { success: true, message: 'Nilai final berhasil diexport' };
  } catch (error) {
    console.error('Error exporting final grades:', error);
    throw error;
  }
};

// --- API untuk Manual TP ---
export const getManualTp = async (id_penugasan, id_ta_semester) => {
  return fetchData(`${API_BASE_URL}/api/guru/manual-tp/${id_penugasan}/${id_ta_semester}`);
};

export const addManualTp = async (id_penugasan, id_ta_semester, tp_number, tp_name) => {
  return fetchData(`${API_BASE_URL}/api/guru/manual-tp`, {
    method: 'POST',
    body: JSON.stringify({ id_penugasan, id_ta_semester, tp_number, tp_name })
  });
};

export const deleteManualTp = async (id_manual_tp) => {
  return fetchData(`${API_BASE_URL}/api/guru/manual-tp/${id_manual_tp}`, {
    method: 'DELETE'
  });
};

export const getPenugasanByGuruMapelKelas = async (id_guru, id_mapel, id_kelas, id_ta_semester) => {
  return fetchData(`${API_BASE_URL}/api/guru/penugasan/${id_guru}/${id_mapel}/${id_kelas}/${id_ta_semester}`);
};


