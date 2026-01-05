// frontend/src/components/TokenExpiryWarning.js
// ⚠️ DISABLED: This component cannot access HTTP-only cookies from JavaScript
// TODO: Re-implement using backend expiry endpoint or server-sent events
// For now, rely on 401 responses from backend to handle token expiration

import React from 'react';

const TokenExpiryWarning = ({ isLoggedIn, onLogout, onRefresh }) => {
  // Component disabled - HTTP-only cookies can't be accessed by JavaScript
  // Token expiration is now handled by backend 401 responses
  return null;
};

export default TokenExpiryWarning;
