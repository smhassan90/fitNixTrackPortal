import axios from 'axios';

// Use relative URLs to go through Next.js API routes (which act as a proxy)
// This avoids CORS issues since Next.js API routes run server-side
// The Next.js API routes will forward requests to the external API
const API_URL = ''; // Empty baseURL means relative URLs (same origin)

console.log('🔧 API Client initialized with relative URLs (using Next.js API routes as proxy)');

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
    } catch (e) {
      console.warn('Failed to parse user from localStorage:', e);
    }
  }
  
  // Log request details (except sensitive data)
  console.log('📤 API Request:', {
    method: config.method?.toUpperCase(),
    url: config.url,
    baseURL: config.baseURL,
    fullURL: `${config.baseURL}${config.url}`,
    hasToken: !!token,
    hasGymId: !!config.headers['X-Gym-Id'],
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





