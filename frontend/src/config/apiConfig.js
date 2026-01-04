// frontend/src/config/apiConfig.js
// Auto-detect API Base URL untuk local network access

/**
 * Deteksi API Base URL berdasarkan hostname yang digunakan untuk akses frontend
 * - Kalau akses via localhost -> backend di localhost:5000
 * - Kalau akses via IP (192.168.x.x) -> backend di IP yang sama port 5000
 */
export const getApiBaseUrl = () => {
  // Kalau ada environment variable, pakai itu (prioritas tertinggi)
  if (process.env.REACT_APP_API_BASE_URL) {
    return process.env.REACT_APP_API_BASE_URL;
  }
  
  // Auto-detect berdasarkan hostname
  const hostname = window.location.hostname;
  
  // Kalau akses via localhost atau 127.0.0.1, backend juga di localhost
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:5000';
  }
  
  // Kalau akses via IP address (contoh: 192.168.1.4), backend juga di IP yang sama
  // Asumsi: frontend dan backend jalan di komputer yang sama
  return `http://${hostname}:5000`;
};

export const API_BASE_URL = getApiBaseUrl();

// Log untuk debugging (bisa dihapus nanti)
console.log('🌐 API Base URL:', API_BASE_URL);
