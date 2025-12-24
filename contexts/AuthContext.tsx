'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/errorHandler';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  gymId: string;
  gymName?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const checkAuth = async () => {
      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');

      if (storedToken && storedUser) {
        try {
          // Verify token is still valid by fetching current user
          const response = await api.get('/api/auth/me');
          if (response.data.success) {
            const userData = response.data.data;
            setUser({
              id: userData.id,
              name: userData.name,
              email: userData.email,
              role: userData.role,
              gymId: userData.gymId,
              gymName: userData.gymName,
            });
            setToken(storedToken);
          } else {
            // Token invalid, clear storage
            localStorage.removeItem('token');
            localStorage.removeItem('user');
          }
        } catch (error) {
          // Token expired or invalid, clear storage
          console.error('Token validation failed:', error);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const loginUrl = `${apiUrl}/api/auth/login`;
      
      console.log('🔵 Attempting login with API...');
      console.log('API Base URL:', apiUrl);
      console.log('Login URL:', loginUrl);
      console.log('Request payload:', { email, password: '***' });
      
      const response = await api.post('/api/auth/login', { email, password });
      
      console.log('✅ Login API Response received:', response);
      console.log('Response data:', response.data);
      console.log('Response status:', response.status);

      if (response.data.success) {
        const { token: authToken, user: userData } = response.data.data;
        
        console.log('Token received:', authToken ? 'Yes' : 'No');
        console.log('User data received:', userData);
        
        // Store token and user
        localStorage.setItem('token', authToken);
        localStorage.setItem('user', JSON.stringify(userData));
        
        setToken(authToken);
        setUser({
          id: userData.id,
          name: userData.name,
          email: userData.email,
          role: userData.role,
          gymId: userData.gymId,
          gymName: userData.gymName,
        });
        
        console.log('✅ Login successful - token and user stored');
      } else {
        console.error('❌ API returned success=false:', response.data);
        throw new Error(response.data.error?.message || 'Login failed');
      }
    } catch (error: any) {
      console.error('❌ Login error caught:', error);
      console.error('Error type:', typeof error);
      console.error('Error message:', error.message);
      console.error('Error response:', error.response);
      console.error('Error config:', error.config);
      
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      
      if (error.request) {
        console.error('Request made but no response:', error.request);
      }
      
      const errorMessage = getErrorMessage(error);
      console.error('Final error message:', errorMessage);
      throw new Error(errorMessage);
    }
  };

  const logout = async () => {
    try {
      // Call logout API if token exists
      if (token) {
        await api.post('/api/auth/logout');
      }
    } catch (error) {
      console.error('Logout API error:', error);
      // Continue with logout even if API call fails
    } finally {
      setToken(null);
      setUser(null);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

