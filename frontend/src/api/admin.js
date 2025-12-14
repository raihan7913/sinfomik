// frontend/src/api/admin.js
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

// --- Fungsi Umum untuk Panggilan API dengan JWT ---
const fetchData = async (url, options = {}) => {
  try {
    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers
    };
    
    const response = await fetch(url, { ...options, headers });
    
    // Handle 401 Unauthorized with redirect guard
    if (response.status === 401) {
      const now = Date.now();
      const last = window.__lastAuthRedirect || 0;
      if (now - last > 5000) {
        window.__lastAuthRedirect = now;
        
        // Try to get response body for detailed error info
        const errorData = await response.json().catch(() => ({}));
        
        // Clear session data
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('userRole');
        localStorage.removeItem('username');
        localStorage.removeItem('userId');
        
        // Handle session invalidation from other device
        if (errorData.sessionInvalidated) {
          // Store message for display on login page
          sessionStorage.setItem('sessionInvalidatedMessage', 
            errorData.message || 'Anda login dari device lain. Sesi sebelumnya ditutup untuk keamanan.'
          );
          window.location.replace('/login');
          throw new Error('Session invalidated from another device');
        }
        
        // Generic session expiry
        sessionStorage.setItem('sessionExpiredMessage', 'Sesi login Anda telah berakhir. Silakan login kembali.');
        window.location.replace('/login');
      }
      throw new Error('Session expired');
    }
    
    // Handle 429 Rate Limit without retry
    if (response.status === 429) {
      const data429 = await response.json().catch(() => ({}));
      throw new Error(data429.message || 'Rate limit exceeded. Please wait.');
    }
    
    if (response.status === 401) {
      // Throw error with details - UI will handle redirect or show message
      const data401 = await response.json().catch(() => ({}));
      const err = new Error(data401.message || 'Unauthorized');
      err.details = data401;
      throw err;
    }
    const data = await response.json();
    
    if (!response.ok) {
      // Jika respons bukan 2xx, lempar error dengan pesan dari backend
      throw new Error(data.message || 'Terjadi kesalahan pada server.');
    }
    return data;
  } catch (error) {
    console.error(`Error fetching from ${url}:`, error);
    throw error;
  }
};

// --- API untuk Tahun Ajaran & Semester ---
export const getTASemester = async () => {
  return fetchData(`${API_BASE_URL}/api/admin/ta-semester`);
};

export const addTASemester = async (tahunAjaran, semester) => {
  return fetchData(`${API_BASE_URL}/api/admin/ta-semester`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tahun_ajaran: tahunAjaran, semester: semester }),
  });
};

export const setActiveTASemester = async (id_ta_semester) => {
  return fetchData(`${API_BASE_URL}/api/admin/ta-semester/set-active/${id_ta_semester}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
  });
};

export const deleteTASemester = async (id_ta_semester) => {
  return fetchData(`${API_BASE_URL}/api/admin/ta-semester/${id_ta_semester}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });
};

// --- API untuk Siswa ---
export const getStudents = async () => {
  return fetchData(`${API_BASE_URL}/api/admin/students`);
};

export const addStudent = async (studentData) => {
  return fetchData(`${API_BASE_URL}/api/admin/students`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(studentData),
  });
};

export const updateStudent = async (id_siswa, studentData) => {
  return fetchData(`${API_BASE_URL}/api/admin/students/${id_siswa}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(studentData),
  });
};

export const deleteStudent = async (id_siswa) => {
  return fetchData(`${API_BASE_URL}/api/admin/students/${id_siswa}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });
};

// --- API untuk Guru ---
export const getTeachers = async () => {
  return fetchData(`${API_BASE_URL}/api/admin/teachers`);
};

export const addTeacher = async (teacherData) => {
  return fetchData(`${API_BASE_URL}/api/admin/teachers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(teacherData),
  });
};

export const updateTeacher = async (id_guru, teacherData) => {
  return fetchData(`${API_BASE_URL}/api/admin/teachers/${id_guru}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(teacherData),
  });
};

export const deleteTeacher = async (id_guru) => {
  return fetchData(`${API_BASE_URL}/api/admin/teachers/${id_guru}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });
};

// --- API untuk Kelas ---
export const getKelas = async (id_ta_semester = '') => {
  const url = id_ta_semester ? `${API_BASE_URL}/api/admin/kelas?id_ta_semester=${id_ta_semester}` : `${API_BASE_URL}/api/admin/kelas`;
  return fetchData(url);
};

export const addKelas = async (kelasData) => {
  return fetchData(`${API_BASE_URL}/api/admin/kelas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(kelasData),
  });
};

export const updateKelas = async (id_kelas, kelasData) => {
  return fetchData(`${API_BASE_URL}/api/admin/kelas/${id_kelas}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(kelasData),
  });
};

export const deleteKelas = async (id_kelas) => {
  return fetchData(`${API_BASE_URL}/api/admin/kelas/${id_kelas}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });
};

// --- API untuk Mata Pelajaran ---
export const getMataPelajaran = async () => {
  return fetchData(`${API_BASE_URL}/api/admin/mapel`);
};

export const addMataPelajaran = async (nama_mapel) => {
  return fetchData(`${API_BASE_URL}/api/admin/mapel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nama_mapel }),
  });
};

export const updateMataPelajaran = async (id_mapel, nama_mapel) => {
  return fetchData(`${API_BASE_URL}/api/admin/mapel/${id_mapel}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nama_mapel }),
  });
};

export const deleteMataPelajaran = async (id_mapel) => {
  return fetchData(`${API_BASE_URL}/api/admin/mapel/${id_mapel}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });
};

// --- API untuk Tipe Nilai ---
export const getTipeNilai = async () => {
  return fetchData(`${API_BASE_URL}/api/admin/tipe-nilai`);
};

export const addTipeNilai = async (tipeNilaiData) => {
  return fetchData(`${API_BASE_URL}/api/admin/tipe-nilai`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tipeNilaiData),
  });
};

export const updateTipeNilai = async (id_tipe_nilai, tipeNilaiData) => {
  return fetchData(`${API_BASE_URL}/api/admin/tipe-nilai/${id_tipe_nilai}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tipeNilaiData),
  });
};

export const deleteTipeNilai = async (id_tipe_nilai) => {
  return fetchData(`${API_BASE_URL}/api/admin/tipe-nilai/${id_tipe_nilai}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });
};

// --- API untuk Penugasan Siswa ke Kelas ---
export const assignSiswaToKelas = async (assignmentData) => {
  return fetchData(`${API_BASE_URL}/api/admin/siswa-kelas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(assignmentData),
  });
};

export const getSiswaInKelas = async (id_kelas, id_ta_semester) => {
  return fetchData(`${API_BASE_URL}/api/admin/siswa-in-kelas/${id_kelas}/${id_ta_semester}`);
};

export const unassignSiswaFromKelas = async (unassignmentData) => {
  return fetchData(`${API_BASE_URL}/api/admin/siswa-kelas`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(unassignmentData),
  });
};

// --- API untuk Penugasan Guru ke Mapel & Kelas ---
export const assignGuruToMapelKelas = async (assignmentData) => {
  return fetchData(`${API_BASE_URL}/api/admin/guru-mapel-kelas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(assignmentData),
  });
};

export const getGuruMapelKelasAssignments = async (id_ta_semester) => {
  return fetchData(`${API_BASE_URL}/api/admin/guru-mapel-kelas/${id_ta_semester}`);
};

export const deleteGuruMapelKelasAssignment = async (id_guru_mapel_kelas) => {
  return fetchData(`${API_BASE_URL}/api/admin/guru-mapel-kelas/assignment/${id_guru_mapel_kelas}`, {
    method: 'DELETE',
  });
};

// --- API untuk Update Wali Kelas ---
export const updateWaliKelas = async (id_kelas, id_guru) => {
  return fetchData(`${API_BASE_URL}/api/admin/kelas/${id_kelas}/wali-kelas`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id_guru }),
  });
};

export const removeWaliKelas = async (id_kelas) => {
  return fetchData(`${API_BASE_URL}/api/admin/kelas/${id_kelas}/wali-kelas`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id_guru: null }),
  });
};

// --- API untuk Capaian Pembelajaran (CP) ---
export const getCapaianPembelajaran = async (id_mapel = '') => { // Bisa filter by mapel
  const url = id_mapel ? `${API_BASE_URL}/api/admin/cp?id_mapel=${id_mapel}` : `${API_BASE_URL}/api/admin/cp`;
  return fetchData(url);
};

export const addCapaianPembelajaran = async (cpData) => {
  return fetchData(`${API_BASE_URL}/api/admin/cp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cpData),
  });
};

export const updateCapaianPembelajaran = async (id_cp, cpData) => {
  return fetchData(`${API_BASE_URL}/api/admin/cp/${id_cp}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cpData),
  });
};

export const deleteCapaianPembelajaran = async (id_cp) => {
  return fetchData(`${API_BASE_URL}/api/admin/cp/${id_cp}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });
};

// --- API untuk Kenaikan Kelas ---
export const promoteStudents = async (student_ids, target_kelas_id, target_ta_semester_id) => {
  return fetchData(`${API_BASE_URL}/api/admin/promote-students`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ student_ids, target_kelas_id, target_ta_semester_id }),
  });
};

// --- API untuk Import/Export Siswa ---
export const downloadStudentTemplate = async () => {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/api/excel/students/template`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to download template');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Template_Import_Siswa.xlsx';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    return { success: true, message: 'Template berhasil diunduh' };
  } catch (error) {
    console.error('Error downloading template:', error);
    throw error;
  }
};

export const importStudents = async (file) => {
  try {
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/api/excel/students/import`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Gagal import siswa');
    }

    return data;
  } catch (error) {
    console.error('Error importing students:', error);
    throw error;
  }
};

// --- API untuk Excel Import Enrollment ---
export const downloadEnrollmentTemplate = async () => {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/api/excel/enrollment/template`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Gagal download template');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Template_Import_Enrollment.xlsx';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error) {
    console.error('Error downloading enrollment template:', error);
    throw error;
  }
};

export const importEnrollment = async (file) => {
  try {
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/api/excel/enrollment/import`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    const data = await response.json();

    if (!response.ok) {
      const err = new Error(data.message || 'Gagal import enrollment');
      err.details = data.details || null;
      throw err;
    }

    return data;
  } catch (error) {
    console.error('Error importing enrollment:', error);
    throw error;
  }
};
