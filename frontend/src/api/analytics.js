// frontend/src/api/analytics.js
import { API_BASE_URL } from '../config/apiConfig';

// Helper to add JWT token to requests
const fetchWithAuth = async (url, options = {}) => {
    const token = localStorage.getItem('token');
    const headers = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers
    };
    
    const response = await fetch(url, { ...options, headers });
    
    if (response.status === 401) {
        // Prevent redirect storm: only redirect once per 5s window
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
        // Rate limit hit: do NOT retry automatically, surface message
        const data429 = await response.json().catch(()=>({}));
        throw new Error(data429.message || 'Rate limit exceeded. Please wait.');
    }
    
    if (!response.ok) {
        throw new Error(`Request failed: ${response.statusText}`);
    }
    
    return response.json();
};

/**
 * Fetch school-wide analytics
 * @param {Object} params - { id_mapel?, id_ta_semester? }
 * @returns {Promise<Object>} School analytics data
 */
export const fetchSchoolAnalytics = async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const url = `${API_BASE_URL}/api/analytics/school${queryString ? `?${queryString}` : ''}`;
    return fetchWithAuth(url);
};

/**
 * Fetch angkatan analytics
 * @param {string} tahunAjaranMasuk - Tahun ajaran masuk (e.g., "2023/2024")
 * @param {Object} params - { id_mapel? }
 * @returns {Promise<Object>} Angkatan analytics data
 */
export const fetchAngkatanAnalytics = async (tahunAjaranMasuk, params = {}) => {
    // Put tahun_ajaran_masuk in query string to avoid encoded-slash routing issues
    const allParams = { ...params, tahun_ajaran_masuk: tahunAjaranMasuk };
    const queryString = new URLSearchParams(allParams).toString();
    const url = `${API_BASE_URL}/api/analytics/angkatan?${queryString}`;
    return fetchWithAuth(url);
};

/**
 * Fetch list of available angkatan
 * @returns {Promise<Array>} List of angkatan
 */
export const fetchAngkatanList = async () => {
    const url = `${API_BASE_URL}/api/analytics/angkatan-list`;
    return fetchWithAuth(url);
};

/**
 * Fetch student individual analytics (kenang-kenangan)
 * @param {number} idSiswa - Student ID
 * @param {Object} params - { id_mapel? }
 * @returns {Promise<Object>} Student analytics data
 */
export const fetchStudentAnalytics = async (idSiswa, params = {}) => {
    // Remove empty params
    const cleanParams = {};
    if (params.id_mapel && params.id_mapel !== '') {
        cleanParams.id_mapel = params.id_mapel;
    }
    
    const queryString = new URLSearchParams(cleanParams).toString();
    const url = `${API_BASE_URL}/api/analytics/student/${idSiswa}${queryString ? `?${queryString}` : ''}`;
    return fetchWithAuth(url);
};

/**
 * Fetch per-TP details for a student's mapel
 * @param {number|string} idSiswa
 * @param {number|string} idMapel
 * @param {Object} params - { id_ta_semester? }
 */
export const fetchStudentMapelDetails = async (idSiswa, idMapel, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const url = `${API_BASE_URL}/api/analytics/student/${idSiswa}/mapel/${idMapel}/details${queryString ? `?${queryString}` : ''}`;
    return fetchWithAuth(url);
};

/**
 * Fetch guru subject analytics
 * @param {number} idGuru - Guru ID
 * @param {Object} params - { id_mapel?, id_kelas?, id_ta_semester? }
 * @returns {Promise<Object>} Guru analytics data
 */
export const fetchGuruAnalytics = async (idGuru, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const url = `${API_BASE_URL}/api/analytics/guru/${idGuru}${queryString ? `?${queryString}` : ''}`;
    return fetchWithAuth(url);
};

/**
 * Compare multiple students
 * @param {Array<number>} idSiswaList - Array of student IDs
 * @param {Object} params - { id_mapel? }
 * @returns {Promise<Object>} Comparison data
 */
export const compareStudents = async (idSiswaList, params = {}) => {
    const allParams = {
        ...params,
        id_siswa_list: idSiswaList.join(',')
    };
    const queryString = new URLSearchParams(allParams).toString();
    const url = `${API_BASE_URL}/api/analytics/compare-students?${queryString}`;
    return fetchWithAuth(url);
};
