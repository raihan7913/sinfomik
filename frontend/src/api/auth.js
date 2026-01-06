// frontend/src/api/auth.js
// Fungsi untuk melakukan panggilan API ke backend

// Pastikan untuk mengganti ini dengan URL backend Node.js Anda
// ✅ Azure Production: gunakan backend URL yang benar
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 
                     (window.location.hostname === 'localhost' 
                       ? 'http://localhost:5000' 
                       : 'https://YOUR-BACKEND-APP.azurewebsites.net'); // ⚠️ GANTI dengan URL backend Azure Anda!

export const loginUser = async (username, password, userType) => {
  try {
    console.log('🌐 API Base URL:', API_BASE_URL);
    console.log('🔗 Login endpoint:', `${API_BASE_URL}/api/auth/login`);
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      credentials: 'include', // ✅ Penting! Mengirim dan menerima HTTP-only cookies
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password, user_type: userType }),
    });

    const data = await response.json();

    if (response.ok) { // Status kode 2xx
      // ✅ Token sekarang disimpan sebagai HTTP-only cookie (tidak bisa diakses JavaScript)
      // Hanya simpan user info untuk UI purposes (bukan token!)
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('isSuperAdmin', (data.user && data.user.role === 'superadmin') ? 'true' : 'false');
      console.log('✅ Login successful, token stored as HTTP-only cookie');
      console.log('🍪 Cookies after login:', document.cookie); // Debug: check if any cookies visible
      console.log('📱 User agent:', navigator.userAgent); // Debug: check device/browser
      
      return { success: true, message: data.message, user: data.user };
    } else { // Status kode 4xx atau 5xx
      return { success: false, message: data.message || 'Login gagal.' };
    }
  } catch (error) {
    console.error('Error during login API call:', error);
    return { success: false, message: 'Tidak dapat terhubung ke server.' };
  }
};

// Logout function - harus clear cookie dari server
export const logoutUser = async () => {
  try {
    // Panggil endpoint logout di backend untuk clear HTTP-only cookie
    await fetch(`${API_BASE_URL}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include' // Kirim cookie untuk identifikasi
    });
  } catch (error) {
    console.error('Error during logout:', error);
  }
  
  // Clear localStorage (user info only)
  localStorage.removeItem('user');
  localStorage.removeItem('isSuperAdmin');
  console.log('✅ User logged out, session cleared');
};

// Anda bisa menambahkan fungsi API lain di sini, misalnya untuk register, fetch data siswa, dll.
