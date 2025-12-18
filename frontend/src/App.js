    // frontend/src/App.js
    import React, { useState, useEffect } from 'react';
    import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
    import LoginPage from './pages/LoginPage';
    import DashboardPage from './pages/DashboardPage';
    import PWAInstallPrompt from './components/PWAInstallPrompt';
    import TokenExpiryWarning from './components/TokenExpiryWarning';

    function App() {
  // State untuk melacak status login pengguna
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState(null); // 'admin', 'guru'
  const [username, setUsername] = useState(null); // Nama pengguna yang login
  const [userId, setUserId] = useState(null); // ID pengguna yang login
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

      // Efek untuk memeriksa status login dari localStorage (jika ada)
      useEffect(() => {
        const storedLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
        const storedUserRole = localStorage.getItem('userRole');
        const storedUsername = localStorage.getItem('username');
        const storedUserId = localStorage.getItem('userId'); // Ambil userId dari localStorage
        const storedIsSuper = localStorage.getItem('isSuperAdmin') === 'true';

        if (storedLoggedIn && storedUserRole && storedUsername && storedUserId) {
          setIsLoggedIn(storedLoggedIn);
          setUserRole(storedUserRole);
          setUsername(storedUsername);
          setUserId(storedUserId); // Set userId
          setIsSuperAdmin(storedIsSuper);
        }
      }, []);

      // Fungsi untuk menangani login
      // Tambahkan parameter 'id' untuk userId and roleName for superadmin flag
      const handleLogin = (role, name, id, roleName) => {
        setIsLoggedIn(true);
        setUserRole(role);
        setUsername(name);
        setUserId(id); // Set userId di state
        setIsSuperAdmin(roleName === 'superadmin');
        // Simpan status login di localStorage
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('userRole', role);
        localStorage.setItem('username', name);
        localStorage.setItem('userId', id); // Simpan userId di localStorage
        localStorage.setItem('isSuperAdmin', roleName === 'superadmin' ? 'true' : 'false');
      };

      // Fungsi untuk menangani logout
      const handleLogout = () => {
        setIsLoggedIn(false);
        setUserRole(null);
        setUsername(null);
        setUserId(null);
        // Hapus status login dari localStorage
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('userRole');
        localStorage.removeItem('username');
        localStorage.removeItem('userId'); // Hapus userId dari localStorage
      };

      return (
        <Router>
          <Routes>
            {/* Route untuk halaman login */}
            <Route path="/login" element={
              isLoggedIn ? (
                // Jika sudah login, redirect ke dashboard yang sesuai
                <Navigate to={`/${userRole}-dashboard`} replace />
              ) : (
                // Jika belum login, tampilkan halaman login
                <LoginPage onLogin={handleLogin} />
              )
            } />

            {/* Route untuk dashboard Admin */}
            <Route path="/admin-dashboard" element={
              isLoggedIn && userRole === 'admin' ? (
                <DashboardPage userRole={userRole} username={username} userId={userId} isSuperAdmin={isSuperAdmin} onLogout={handleLogout} />
              ) : (
                // Jika tidak login atau bukan admin, redirect ke login
                <Navigate to="/login" replace />
              )
            } />

            {/* Route untuk dashboard Guru */}
            <Route path="/guru-dashboard" element={
              isLoggedIn && userRole === 'guru' ? (
                <DashboardPage userRole={userRole} username={username} userId={userId} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            } />

          {/* Default route: redirect ke login jika tidak ada path yang cocok */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
          
          {/* Token Expiry Warning - show when user is logged in and token about to expire */}
          <TokenExpiryWarning 
            isLoggedIn={isLoggedIn}
            onLogout={handleLogout}
            onRefresh={() => {
              // Optional: Implement token refresh logic here
              // For now, this is just a placeholder for staying logged in
            }}
          />
          
          {/* PWA Install Prompt */}
          <PWAInstallPrompt />
        </Router>
      );
    }

    export default App;
    