// frontend/src/utils/tokenHelper.js
/**
 * Helper functions for JWT token management
 */

/**
 * Decode JWT token payload (without verification - safe on client side)
 * @param {string} token - JWT token
 * @returns {object} Decoded payload
 */
export const decodeToken = (token) => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }
    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch (err) {
    console.error('Error decoding token:', err);
    return null;
  }
};

/**
 * Get token expiry time
 * @param {string} token - JWT token
 * @returns {number} Milliseconds until expiry (or 0 if expired)
 */
export const getTokenTimeLeft = (token) => {
  const payload = decodeToken(token);
  if (!payload || !payload.exp) {
    return 0;
  }
  const expiresAt = payload.exp * 1000; // Convert to milliseconds
  const now = Date.now();
  return Math.max(0, expiresAt - now);
};

/**
 * Check if token is expired
 * @param {string} token - JWT token
 * @returns {boolean} True if token is expired
 */
export const isTokenExpired = (token) => {
  return getTokenTimeLeft(token) <= 0;
};

/**
 * Check if token will expire soon (within threshold)
 * @param {string} token - JWT token
 * @param {number} thresholdMs - Threshold in milliseconds (default: 5 minutes)
 * @returns {boolean} True if token will expire within threshold
 */
export const isTokenExpiringSoon = (token, thresholdMs = 300000) => {
  const timeLeft = getTokenTimeLeft(token);
  return timeLeft > 0 && timeLeft <= thresholdMs;
};

/**
 * Clear all auth data from localStorage
 */
export const clearAuthData = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('isLoggedIn');
  localStorage.removeItem('userRole');
  localStorage.removeItem('username');
  localStorage.removeItem('userId');
};

/**
 * Format time remaining for display
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted time string (MM:SS)
 */
export const formatTimeLeft = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${String(secs).padStart(2, '0')}`;
};
