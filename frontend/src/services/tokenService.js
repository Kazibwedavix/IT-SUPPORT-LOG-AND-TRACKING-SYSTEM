// frontend/src/services/tokenService.js
// Token storage and management service

// Get access token
export const getToken = () => {
  return localStorage.getItem('accessToken');
};

// Get refresh token
export const getRefreshToken = () => {
  return localStorage.getItem('refreshToken');
};

// Set tokens
export const setTokens = (accessToken, refreshToken) => {
  if (accessToken) {
    localStorage.setItem('accessToken', accessToken);
  }
  if (refreshToken) {
    localStorage.setItem('refreshToken', refreshToken);
  }
};

// Clear all tokens
export const clearTokens = () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
};

// Check if user is authenticated
export const isAuthenticated = () => {
  const token = getToken();
  return !!token;
};

// Get stored user data
export const getUser = () => {
  const userStr = localStorage.getItem('user');
  if (userStr) {
    try {
      return JSON.parse(userStr);
    } catch (error) {
      console.error('Error parsing user data:', error);
      return null;
    }
  }
  return null;
};

// Set user data
export const setUser = (userData) => {
  if (userData) {
    localStorage.setItem('user', JSON.stringify(userData));
  }
};