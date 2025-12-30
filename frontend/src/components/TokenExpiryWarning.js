// frontend/src/components/TokenExpiryWarning.js
import React, { useState, useEffect, useRef } from 'react';
import Button from './Button';

const TokenExpiryWarning = ({ isLoggedIn, onLogout, onRefresh }) => {
  const [showWarning, setShowWarning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const timersRef = useRef({ expiry: null, countdown: null, periodic: null });

  const clearAllTimers = () => {
    if (timersRef.current.expiry) clearTimeout(timersRef.current.expiry);
    if (timersRef.current.countdown) clearInterval(timersRef.current.countdown);
    if (timersRef.current.periodic) clearInterval(timersRef.current.periodic);
    timersRef.current = { expiry: null, countdown: null, periodic: null };
  };

  const handleTokenExpired = () => {
    console.log('[TOKEN] Token expired, logging out');
    setShowWarning(false);
    clearAllTimers();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('userRole');
    localStorage.removeItem('username');
    localStorage.removeItem('userId');
    onLogout();
  };

  const startCountdown = (initialSeconds) => {
    // Clear any existing countdown
    if (timersRef.current.countdown) clearInterval(timersRef.current.countdown);
    
    setShowWarning(true);
    setTimeLeft(initialSeconds);

    timersRef.current.countdown = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          if (timersRef.current.countdown) {
            clearInterval(timersRef.current.countdown);
            timersRef.current.countdown = null;
          }
          handleTokenExpired();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const checkTokenExpiry = () => {
    const token = localStorage.getItem('token');
    if (!token) {
      handleTokenExpired();
      return;
    }

    try {
      // Decode JWT payload
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expiresAt = payload.exp * 1000;
      const now = Date.now();
      const timeUntilExpiry = expiresAt - now;

      console.log(`[TOKEN] Time until expiry: ${Math.ceil(timeUntilExpiry / 1000)}s`);

      if (timeUntilExpiry <= 0) {
        // Token expired
        handleTokenExpired();
      } else if (timeUntilExpiry <= 1800000) {
        // 30 minutes or less - show warning
        const secondsLeft = Math.ceil(timeUntilExpiry / 1000);
        if (!showWarning) {
          console.log(`[TOKEN] Showing warning, ${secondsLeft}s left`);
          startCountdown(secondsLeft);
        }
      } else {
        // More than 30 minutes - hide warning and schedule next check
        setShowWarning(false);
        if (timersRef.current.countdown) {
          clearInterval(timersRef.current.countdown);
          timersRef.current.countdown = null;
        }
        
        const timeUntilWarning = timeUntilExpiry - 1800000;
        if (timersRef.current.expiry) clearTimeout(timersRef.current.expiry);
        timersRef.current.expiry = setTimeout(checkTokenExpiry, timeUntilWarning);
      }
    } catch (err) {
      console.error('[TOKEN] Error checking token expiry:', err);
      handleTokenExpired();
    }
  };

  useEffect(() => {
    if (!isLoggedIn) {
      clearAllTimers();
      setShowWarning(false);
      return;
    }

    // Check immediately
    checkTokenExpiry();

    // Also check periodically every 30 seconds
    timersRef.current.periodic = setInterval(checkTokenExpiry, 30000);

    return () => {
      clearAllTimers();
    };
  }, [isLoggedIn]);

  const handleStayLogin = async () => {
    try {
      // Make a simple API call to refresh/extend the session
      const token = localStorage.getItem('token');
      const response = await fetch('/api/auth/me', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        console.log('[TOKEN] Stay login successful, resetting warning');
        // Reset everything
        setShowWarning(false);
        setTimeLeft(null);
        
        // Clear countdown timer
        if (timersRef.current.countdown) {
          clearInterval(timersRef.current.countdown);
          timersRef.current.countdown = null;
        }
        
        // Force immediate recheck
        checkTokenExpiry();
        
        // Call onRefresh callback if provided
        if (onRefresh) {
          onRefresh();
        }
      } else {
        // Token invalid, logout
        handleTokenExpired();
      }
    } catch (err) {
      console.error('[TOKEN] Error during stay login:', err);
      handleTokenExpired();
    }
  };

  if (!showWarning) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full mx-4 animate-slideInUp">
        <div className="flex items-center justify-center mb-4">
          <div className="bg-yellow-100 rounded-full p-3">
            <i className="fas fa-exclamation-triangle text-yellow-600 text-2xl"></i>
          </div>
        </div>

        <h2 className="text-2xl font-bold text-gray-800 text-center mb-2">
          ⏰ Sesi Akan Berakhir
        </h2>

        <p className="text-gray-600 text-center mb-6">
          Sesi login Anda akan berakhir dalam{' '}
          <span className="font-bold text-red-600 text-lg">
            {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
          </span>
        </p>

        <p className="text-gray-500 text-sm text-center mb-6">
          Klik tombol di bawah untuk tetap login dan melanjutkan pekerjaan Anda.
        </p>

        <div className="flex gap-3">
          <Button
            variant="ghost"
            fullWidth
            onClick={handleTokenExpired}
          >
            Keluar
          </Button>
          <Button
            variant="primary"
            fullWidth
            onClick={handleStayLogin}
            icon="sync-alt"
          >
            Tetap Login
          </Button>
        </div>

        <p className="text-xs text-gray-400 text-center mt-4">
          Jika tidak ada aktivitas, Anda akan keluar otomatis untuk keamanan.
        </p>
      </div>
    </div>
  );
};

export default TokenExpiryWarning;
