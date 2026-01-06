// frontend/src/pages/LoginPage.js
import React, { useState, useEffect } from 'react';
import { loginUser } from '../api/auth'; // Import fungsi login dari API
import feather from 'feather-icons';

function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [userType, setUserType] = useState('admin'); // Default ke admin
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState(''); // 'success' atau 'error'
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    // Initialize feather icons
    feather.replace();
    
    // Check for session invalidation or expiry messages from previous logout
    const sessionInvalidatedMsg = sessionStorage.getItem('sessionInvalidatedMessage');
    const sessionExpiredMsg = sessionStorage.getItem('sessionExpiredMessage');
    
    if (sessionInvalidatedMsg) {
      setMessage(sessionInvalidatedMsg);
      setMessageType('warning');
      sessionStorage.removeItem('sessionInvalidatedMessage');
    } else if (sessionExpiredMsg) {
      setMessage(sessionExpiredMsg);
      setMessageType('info');
      sessionStorage.removeItem('sessionExpiredMessage');
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault(); // Mencegah refresh halaman
    setMessage(''); // Reset pesan
    setMessageType('');

    try {
      const response = await loginUser(username, password, userType);
      console.log('🔍 Login response:', response);
      
      if (response.success) {
        console.log('✅ Login success, user data:', response.user);
        setMessage(response.message);
        setMessageType('success');
        
        // Validate user data before calling onLogin
        if (!response.user || !response.user.type || !response.user.username || !response.user.id) {
          console.error('❌ Invalid user data in response:', response.user);
          setMessage('Error: Data pengguna tidak valid. Silakan hubungi admin.');
          setMessageType('error');
          return;
        }
        
        // Save isSuperAdmin in localStorage and pass role info to App
        localStorage.setItem('isSuperAdmin', response.user && response.user.role === 'superadmin' ? 'true' : 'false');
        console.log('🔄 Calling onLogin with:', response.user.type, response.user.username, response.user.id, response.user.role);
        onLogin(response.user.type, response.user.username, response.user.id, response.user.role);
        // Navigasi akan ditangani oleh App.js melalui Navigate component
      } else {
        console.log('❌ Login failed:', response.message);
        setMessage(response.message);
        setMessageType('error');
      }
    } catch (error) {
      console.error('❌ Login error:', error);
      setMessage('Tidak dapat terhubung ke server.');
      setMessageType('error');
    }
  };

  const handleRoleChange = (role) => {
    setUserType(role);
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
    // Re-initialize feather icons after DOM change
    setTimeout(() => feather.replace(), 0);
  };

  return (
    <div className="bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100 min-h-screen overflow-y-auto overflow-x-hidden animate-fadeIn">
      <div className="flex items-center justify-center p-4 py-8 min-h-screen">
        <div className="container mx-auto px-4 w-full min-w-[320px]">
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              {/* Left Side - Hero Image */}
            <div className="hidden md:block rounded-3xl overflow-hidden shadow-2xl relative transform hover:scale-[1.02] transition-transform duration-500">
              <img src="\bglogin.jpg" alt="Sekolah Bhinekas" className="w-full h-[500px] object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-indigo-900/80 via-indigo-600/40 to-transparent"></div>
              <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
                <div className="backdrop-blur-sm bg-white/10 rounded-2xl p-6">
                  <h2 className="text-3xl font-bold mb-2">Sekolah Bhinekas</h2>
                  <p className="text-lg opacity-90">Membangun Generasi Cerdas dan Berkarakter</p>
                  <div className="flex gap-4 mt-4">
                    <div className="flex items-center gap-2">
                      <i data-feather="award" className="w-5 h-5"></i>
                      <span className="text-sm">Akreditasi A</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <i data-feather="users" className="w-5 h-5"></i>
                      <span className="text-sm">1000+ Siswa</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Side - Login Form */}
            <div className="bg-white/95 backdrop-blur-md p-10 rounded-3xl shadow-2xl login-card border border-white/20">
              <div className="text-center mb-8">
                <div className="inline-block p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl mb-4 shadow-lg">
                  <img src="\logo-binekas.png" alt="School Logo" className="w-16 h-16 rounded-xl object-cover" />
                </div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mt-4">
                  Portal Login
                </h1>
                <p className="text-gray-600 mt-2 font-medium">Sistem Informasi Akademik</p>
              </div>

              <div className="flex justify-center gap-4 mb-8">
                <button
                  type="button"
                  onClick={() => handleRoleChange('admin')}
                  className={`role-btn px-6 py-3 rounded-xl font-semibold flex items-center transition-all duration-300 ${
                    userType === 'admin'
                      ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-500/50 scale-105'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <i data-feather="shield" className="mr-2 w-5 h-5"></i> Admin
                </button>
                <button
                  type="button"
                  onClick={() => handleRoleChange('guru')}
                  className={`role-btn px-6 py-3 rounded-xl font-semibold flex items-center transition-all duration-300 ${
                    userType === 'guru'
                      ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-500/50 scale-105'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <i data-feather="user" className="mr-2 w-5 h-5"></i> Guru
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="username" className="block text-sm font-semibold text-gray-700 mb-2">
                    <i data-feather="user" className="inline w-4 h-4 mr-1"></i>
                    Username
                  </label>
                  <input
                    type="text"
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="block w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all duration-200 hover:border-gray-300"
                    placeholder="Masukkan username"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                    <i data-feather="lock" className="inline w-4 h-4 mr-1"></i>
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full px-4 py-3 pr-12 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all duration-200 hover:border-gray-300"
                      placeholder="Masukkan password"
                      required
                    />
                    <button
                      type="button"
                      onClick={togglePasswordVisibility}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-indigo-600 transition-colors"
                    >
                      <i
                        data-feather={showPassword ? 'eye-off' : 'eye'}
                        className="w-5 h-5"
                      ></i>
                    </button>
                  </div>
                </div>

                <div className="flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded transition-all"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700 font-medium">
                    Ingat saya
                  </label>
                </div>

                <div>
                  <button
                    type="submit"
                    className="w-full flex justify-center items-center py-4 px-4 border border-transparent rounded-xl shadow-lg text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-4 focus:ring-indigo-300 font-semibold text-lg transition-all duration-300 hover:scale-[1.02] active:scale-95"
                  >
                    <span>Masuk</span>
                    <i data-feather="log-in" className="ml-2 w-5 h-5"></i>
                  </button>
                </div>
              </form>

              {message && (
                <div className={`mt-6 p-4 rounded-xl text-center font-semibold flex items-center justify-center gap-2 animate-slideInUp ${
                  messageType === 'success'
                    ? 'bg-green-50 text-green-800 border-2 border-green-200'
                    : 'bg-red-50 text-red-800 border-2 border-red-200'
                }`}>
                  <i data-feather={messageType === 'success' ? 'check-circle' : 'alert-circle'} className="w-5 h-5"></i>
                  {message}
                </div>
              )}

              <div className="mt-8 text-center text-sm text-gray-500">
                <p className="font-medium">© 2025 Sekolah Bhinekas</p>
                <p className="mt-1">Sistem Informasi Akademik v2.0</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;    