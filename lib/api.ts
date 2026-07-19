import axios from 'axios';
import { isJwtExpired } from './jwtClient';

// Use relative URLs to go through Next.js API routes (which act as a proxy)
// This avoids CORS issues since Next.js API routes run server-side
// The Next.js API routes will forward requests to the external API
const API_URL = ''; // Empty baseURL means relative URLs (same origin)

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token and gym ID to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  // Add X-Gym-Id header from user context
  const storedUser = localStorage.getItem('user');
  if (storedUser) {
    try {
      const user = JSON.parse(storedUser);
      if (user.gymId) {
        config.headers['X-Gym-Id'] = user.gymId;
      }
    } catch {
      /* ignore invalid stored user */
    }
  }

  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('❌ API Error Response:', {
      status: error.response?.status,
      url: error.config?.url,
      message: error.message,
      responseData: error.response?.data,
    });
    
    if (typeof window !== 'undefined') {
      if (error.response?.status === 401) {
        const requestUrl = String(error.config?.url || '');
        const path = window.location.pathname;
        const token = localStorage.getItem('token');

        // Expired access JWT: sign out and land on login with a clear reason (avoids "Invalid token" on data APIs).
        if (token && token.startsWith('eyJ') && isJwtExpired(token) && !path.startsWith('/login')) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.assign('/login?session=expired');
          return Promise.reject(error);
        }

        const shouldForceLogout =
          requestUrl.includes('/api/auth/me') ||
          requestUrl.includes('/api/auth/logout') ||
          requestUrl.includes('/api/auth/login');

        // Only explicit auth checks force a redirect; other 401s are surfaced in-page (e.g. permission).
        if (shouldForceLogout) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          if (path !== '/login') {
            window.location.href = '/login?session=expired';
          }
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;





