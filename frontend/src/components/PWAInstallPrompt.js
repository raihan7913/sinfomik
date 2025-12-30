// PWA Install Prompt Component
import React, { useEffect, useState } from 'react';

function PWAInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later
      setInstallPrompt(e);
      // Show the install button
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) {
      return;
    }

    // Show the install prompt
    installPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await installPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('✅ User accepted the install prompt');
    } else {
      console.log('❌ User dismissed the install prompt');
    }

    // Clear the saved prompt since it can't be used again
    setInstallPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Store in localStorage that user dismissed
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  // Don't show if already dismissed in last 7 days
  useEffect(() => {
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed);
      const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 7) {
        setShowPrompt(false);
      }
    }
  }, []);

  if (!showPrompt) {
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: 'white',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      borderRadius: '12px',
      padding: '16px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      zIndex: 9999,
      maxWidth: '90%',
      width: '400px',
      animation: 'slideUp 0.3s ease-out'
    }}>
      <style>{`
        @keyframes slideUp {
          from {
            transform: translateX(-50%) translateY(100px);
            opacity: 0;
          }
          to {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
          }
        }
      `}</style>
      
      <div style={{
        fontSize: '32px',
        flexShrink: 0
      }}>
        📱
      </div>
      
      <div style={{ flex: 1 }}>
        <div style={{
          fontWeight: '600',
          fontSize: '14px',
          color: '#1f2937',
          marginBottom: '4px'
        }}>
          Pasang SINFOMIK
        </div>
        <div style={{
          fontSize: '12px',
          color: '#6b7280'
        }}>
          Akses lebih cepat dari home screen
        </div>
      </div>

      <button
        onClick={handleInstallClick}
        style={{
          backgroundColor: '#4F46E5',
          color: 'white',
          border: 'none',
          padding: '8px 16px',
          borderRadius: '6px',
          fontSize: '13px',
          fontWeight: '600',
          cursor: 'pointer',
          whiteSpace: 'nowrap'
        }}
      >
        Pasang
      </button>

      <button
        onClick={handleDismiss}
        style={{
          backgroundColor: 'transparent',
          color: '#9ca3af',
          border: 'none',
          padding: '4px',
          cursor: 'pointer',
          fontSize: '20px',
          lineHeight: 1
        }}
        title="Tutup"
      >
        ×
      </button>
    </div>
  );
}

export default PWAInstallPrompt;
