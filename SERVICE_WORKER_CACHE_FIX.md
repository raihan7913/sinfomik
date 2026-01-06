# 🔧 Service Worker Cache Issues - PWA Update Problem

## ⚠️ MASALAH UTAMA: Service Worker Cache

Aplikasi Sinfomik menggunakan **Progressive Web App (PWA)** dengan service worker yang **aktif**. Service worker meng-cache CSS, JS, dan assets lainnya untuk offline functionality.

### 🐛 Gejala Service Worker Cache Issues:

- ✅ **Deploy update baru** → Tapi user masih lihat versi lama
- ✅ **Hard refresh** (Ctrl+Shift+R) → Tidak membantu
- ✅ **Clear browser cache** → Tidak membantu
- ✅ **Incognito mode** → Bekerja normal (karena no service worker)
- ✅ **Sidebar tidak muncul** di beberapa laptop → Karena cache CSS/JS lama
- ✅ **Behavior berbeda** antar user → Beberapa dapat update, beberapa tidak

### 🔍 Root Cause:

Service worker meng-cache versi lama dari:
- `main.css` (sidebar styling dengan breakpoint 1024px lama)
- `main.js` (logic dengan deteksi mobile lama)
- `index.html`

Bahkan setelah deploy, service worker tetap serve dari cache sampai:
1. Service worker di-unregister
2. Cache di-clear manual
3. Service worker detect ada update (tapi ini bisa delay)

---

## ✅ SOLUSI

### Option 1: Unregister Service Worker (Recommended untuk Development)

#### A. Temporary - Via Browser DevTools

1. **Buka DevTools** (F12)
2. **Application tab** → Service Workers
3. **Unregister** semua service workers
4. **Clear storage:**
   - Application → Storage → Clear site data
5. **Hard refresh** (Ctrl+Shift+R)

#### B. Quick Script - Run di Console

```javascript
// Unregister all service workers
navigator.serviceWorker.getRegistrations().then(function(registrations) {
    for(let registration of registrations) {
        registration.unregister();
        console.log('✅ Service Worker unregistered:', registration);
    }
});

// Clear all caches
caches.keys().then(function(names) {
    for (let name of names) {
        caches.delete(name);
        console.log('✅ Cache deleted:', name);
    }
});

// Reload
setTimeout(() => {
    console.log('🔄 Reloading...');
    location.reload(true);
}, 1000);
```

#### C. Disable Service Worker in Code (Permanent Fix for Development)

**File: `frontend/src/index.js`**

```javascript
// frontend/src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fortawesome/fontawesome-free/css/all.min.css';
import './index.css';
import './utils/silentConsole';
import App from './App';
import reportWebVitals from './reportWebVitals';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// ✅ DISABLE service worker untuk development
// Gunakan unregister() untuk disable PWA caching
if (process.env.NODE_ENV === 'development') {
  serviceWorkerRegistration.unregister();
} else {
  // Di production, tetap gunakan service worker
  serviceWorkerRegistration.register();
}

reportWebVitals();
```

---

### Option 2: Force Update Service Worker (Production)

Jika tetap ingin menggunakan service worker di production, tambahkan version control.

#### A. Update Service Worker dengan Versioning

**File: `frontend/src/service-worker.js`**

Add version check:

```javascript
/* eslint-disable no-restricted-globals */

// ✅ VERSION CONTROL - Update ini setiap deploy major changes
const CACHE_VERSION = 'v2.0.0'; // Increment setiap deploy breaking changes
const CACHE_NAME = `sinfomik-${CACHE_VERSION}`;

import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate, CacheFirst } from 'workbox-strategies';

clientsClaim();

// ✅ Skip waiting - Force activate new service worker immediately
self.skipWaiting();

// Precache all assets
precacheAndRoute(self.__WB_MANIFEST);

// ✅ Clean old caches on activation
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName.startsWith('sinfomik-')) {
            console.log('🗑️ Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Rest of service worker code...
```

#### B. Add Update Notification to Users

**Create: `frontend/src/components/ServiceWorkerUpdate.js`**

```javascript
import React, { useEffect, useState } from 'react';
import * as serviceWorkerRegistration from '../serviceWorkerRegistration';

function ServiceWorkerUpdate() {
  const [showReload, setShowReload] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState(null);

  useEffect(() => {
    const onSWUpdate = (registration) => {
      setShowReload(true);
      setWaitingWorker(registration.waiting);
    };

    // Register service worker with update callback
    serviceWorkerRegistration.register({
      onUpdate: onSWUpdate,
    });
  }, []);

  const reloadPage = () => {
    waitingWorker?.postMessage({ type: 'SKIP_WAITING' });
    setShowReload(false);
    window.location.reload();
  };

  if (!showReload) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '2rem',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: '#4F46E5',
        color: 'white',
        padding: '1rem 2rem',
        borderRadius: '0.5rem',
        boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        animation: 'slideUp 0.3s ease'
      }}
    >
      <div>
        <strong>🎉 Update Tersedia!</strong>
        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem' }}>
          Versi baru aplikasi sudah tersedia.
        </p>
      </div>
      <button
        onClick={reloadPage}
        style={{
          backgroundColor: 'white',
          color: '#4F46E5',
          border: 'none',
          padding: '0.5rem 1.5rem',
          borderRadius: '0.375rem',
          cursor: 'pointer',
          fontWeight: 'bold',
          whiteSpace: 'nowrap'
        }}
      >
        Refresh
      </button>
    </div>
  );
}

export default ServiceWorkerUpdate;
```

**Add to `frontend/src/App.js`:**

```javascript
import ServiceWorkerUpdate from './components/ServiceWorkerUpdate';

function App() {
  // ... existing code ...

  return (
    <>
      <ServiceWorkerUpdate />
      {/* ... rest of app ... */}
    </>
  );
}
```

---

### Option 3: Clear Cache for All Users (Nuclear Option)

Jika banyak user mengalami masalah, deploy script ini di production:

**Add to `public/index.html` (temporary):**

```html
<script>
  // 🚨 NUCLEAR OPTION - Clear all service workers and caches
  // Remove this script after all users updated
  (function() {
    console.log('🧹 Cleaning service worker cache...');
    
    // Unregister all service workers
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function(registrations) {
        for(let registration of registrations) {
          registration.unregister();
          console.log('✅ Service Worker unregistered');
        }
      });
    }
    
    // Clear all caches
    if ('caches' in window) {
      caches.keys().then(function(names) {
        for (let name of names) {
          caches.delete(name);
          console.log('✅ Cache deleted:', name);
        }
      });
    }
    
    // Set flag to prevent repeated clearing
    const cleared = localStorage.getItem('cache-cleared-v2');
    if (!cleared) {
      localStorage.setItem('cache-cleared-v2', 'true');
      console.log('🔄 Reloading page...');
      setTimeout(() => location.reload(true), 1000);
    }
  })();
</script>
```

---

## 🧪 Testing Service Worker Issues

### Check if Service Worker is Active:

```javascript
// Run in console
navigator.serviceWorker.getRegistrations().then((regs) => {
    console.log('Active Service Workers:', regs.length);
    regs.forEach((reg, i) => {
        console.log(`SW ${i+1}:`, {
            scope: reg.scope,
            state: reg.active?.state,
            scriptURL: reg.active?.scriptURL
        });
    });
});
```

### Check Cache Contents:

```javascript
// Run in console
caches.keys().then((names) => {
    console.log('Cache Names:', names);
    names.forEach((name) => {
        caches.open(name).then((cache) => {
            cache.keys().then((keys) => {
                console.log(`Cache "${name}":`, keys.length, 'files');
                keys.slice(0, 5).forEach(req => console.log('  -', req.url));
            });
        });
    });
});
```

### Test Cache Age:

```javascript
// Check if cached files are old
caches.open('workbox-precache-v2-http://localhost:3000/').then((cache) => {
    cache.match('/static/css/main.css').then((response) => {
        if (response) {
            const date = response.headers.get('date');
            console.log('CSS cached on:', date);
            console.log('Age:', Math.floor((Date.now() - new Date(date)) / 1000 / 60), 'minutes');
        }
    });
});
```

---

## 📋 Recommended Approach

### For Development:
```javascript
// frontend/src/index.js
if (process.env.NODE_ENV === 'development') {
  serviceWorkerRegistration.unregister();
} else {
  serviceWorkerRegistration.register();
}
```

### For Production:
1. ✅ Keep service worker enabled
2. ✅ Add version control (CACHE_VERSION)
3. ✅ Add `skipWaiting()` for immediate updates
4. ✅ Add update notification component
5. ✅ Increment version on breaking changes

---

## 🐛 Other Related Issues

### 2. React StrictMode Double Rendering

**Issue:** React.StrictMode causes components to render twice in development.

**Check:**
```javascript
// frontend/src/index.js
root.render(
  <React.StrictMode>  // ← This causes double render
    <App />
  </React.StrictMode>
);
```

**Impact on Sidebar:**
- State initialization runs twice
- localStorage might be read/written twice
- Event listeners might be attached twice

**Solution:** This is intentional for dev mode. Won't affect production.

---

### 3. Browser Extensions

**Extensions that can interfere:**
- 🚫 **Privacy Badger** - Block localStorage
- 🚫 **uBlock Origin** - Block CSS/JS
- 🚫 **NoScript** - Block JavaScript
- 🚫 **Ghostery** - Block tracking (including analytics)
- 🚫 **AdBlock Plus** - Sometimes blocks CSS classes with "ad" names

**Test:**
```javascript
// Detect if localStorage is blocked
try {
  localStorage.setItem('test', '1');
  localStorage.removeItem('test');
  console.log('✅ localStorage works');
} catch (e) {
  console.error('❌ localStorage blocked:', e);
}
```

---

### 4. Font Awesome Load Issues

**Issue:** If Font Awesome CDN/file fails to load, icons won't show.

**Check in Console:**
```javascript
// Verify Font Awesome loaded
const styles = window.getComputedStyle(document.body, ':before');
const fontFamily = styles.getPropertyValue('font-family');
console.log('Font Awesome loaded:', fontFamily.includes('Font Awesome'));
```

**Current Setup:**
```javascript
// frontend/src/index.js
import '@fortawesome/fontawesome-free/css/all.min.css';
```

Should be fine, but check if import works.

---

### 5. Build/Production Issues

**Issue:** Development works, production doesn't.

**Common Causes:**
- Environment variables different
- Build optimization removes code
- PUBLIC_URL misconfigured
- Asset paths broken

**Check:**
```bash
# Build and test locally
npm run build
npx serve -s build

# Check for errors
# Open: http://localhost:3000
```

---

## 📞 Quick Diagnostic

Run this in console to check all potential issues:

```javascript
// ====================================
// SERVICE WORKER & CACHE DIAGNOSTIC
// ====================================

const diagnostic = {
  serviceWorker: {
    supported: 'serviceWorker' in navigator,
    registrations: 0,
    active: false
  },
  cache: {
    supported: 'caches' in window,
    names: [],
    totalFiles: 0
  },
  localStorage: {
    available: false,
    sidebarPref: null,
    error: null
  },
  extensions: {
    likely: false,
    reasons: []
  }
};

// Check Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    diagnostic.serviceWorker.registrations = regs.length;
    diagnostic.serviceWorker.active = regs.length > 0;
    console.log('📡 Service Workers:', regs.length);
  });
}

// Check Caches
if ('caches' in window) {
  caches.keys().then((names) => {
    diagnostic.cache.names = names;
    console.log('💾 Cache Names:', names);
    
    let totalFiles = 0;
    names.forEach((name) => {
      caches.open(name).then((cache) => {
        cache.keys().then((keys) => {
          totalFiles += keys.length;
          diagnostic.cache.totalFiles = totalFiles;
          console.log(`  - ${name}: ${keys.length} files`);
        });
      });
    });
  });
}

// Check localStorage
try {
  diagnostic.localStorage.available = true;
  diagnostic.localStorage.sidebarPref = localStorage.getItem('sidebar-open-preference');
  console.log('💾 LocalStorage:', 'Available');
  console.log('  - Sidebar Pref:', localStorage.getItem('sidebar-open-preference'));
} catch (e) {
  diagnostic.localStorage.available = false;
  diagnostic.localStorage.error = e.message;
  console.error('❌ LocalStorage:', e.message);
  diagnostic.extensions.likely = true;
  diagnostic.extensions.reasons.push('localStorage blocked');
}

// Check extensions indicators
if (window.chrome && window.chrome.runtime) {
  diagnostic.extensions.reasons.push('Chrome extension detected');
}

setTimeout(() => {
  console.log('📊 DIAGNOSTIC COMPLETE:');
  console.table(diagnostic.serviceWorker);
  console.table(diagnostic.cache);
  console.table(diagnostic.localStorage);
  
  if (diagnostic.serviceWorker.active) {
    console.warn('⚠️ SERVICE WORKER IS ACTIVE!');
    console.log('This might cause cache issues. Consider unregistering.');
  }
  
  if (diagnostic.cache.totalFiles > 0) {
    console.warn(`⚠️ ${diagnostic.cache.totalFiles} FILES IN CACHE!`);
    console.log('Old version might be cached. Consider clearing.');
  }
}, 2000);
```

---

## ✅ Summary

**Most Likely Causes for "Sidebar Not Showing":**

1. **Service Worker Cache** (60% probability) ⚠️ HIGH
2. Browser Cache (20%)
3. LocalStorage issues (10%)
4. CSS conflicts (5%)
5. Display scaling (5%)

**Recommended Actions:**

1. **Immediate Fix:** Unregister service worker in development
2. **User Fix:** Provide clear cache script
3. **Production:** Add update notification
4. **Long-term:** Version control + skipWaiting

---

**Last Updated:** January 6, 2026  
**Priority:** CRITICAL - Service Worker can prevent updates from reaching users
