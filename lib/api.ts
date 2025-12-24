import axios from 'axios';

// Base URL should be http://localhost:3001 (without /api)
// Endpoints will be /api/attendance, /api/members, etc.
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

console.log('🔧 API Client initialized with base URL:', API_URL);

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  // Log request details (except sensitive data)
  console.log('📤 API Request:', {
    method: config.method?.toUpperCase(),
    url: config.url,
    baseURL: config.baseURL,
    fullURL: `${config.baseURL}${config.url}`,
    hasToken: !!token,
  });
  
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => {
    console.log('📥 API Response:', {
      status: response.status,
      url: response.config.url,
      data: response.data,
    });
    return response;
  },
  (error) => {
    console.error('❌ API Error Response:', {
      status: error.response?.status,
      url: error.config?.url,
      message: error.message,
      responseData: error.response?.data,
    });
    
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Don't redirect on login page
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;





