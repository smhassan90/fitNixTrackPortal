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
          // Try Next.js API route first
          const response = await fetch('/api/auth/me', {
            headers: {
              'Authorization': `Bearer ${storedToken}`,
            },
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              const userData = data.data;
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
          } else {
            // Try fallback to api instance (external API)
            const apiResponse = await api.get('/api/auth/me');
            if (apiResponse.data.success) {
              const userData = apiResponse.data.data;
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
              localStorage.removeItem('token');
              localStorage.removeItem('user');
            }
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
      // Try Next.js API route first (uses plain password comparison)
      console.log('🔵 Attempting login with Next.js API route (plain password)...');
      console.log('Request payload:', { email, password: '***' });
      
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });
      
      const data = await response.json();
      
      console.log('✅ Login API Response received:', data);
      console.log('Response status:', response.status);

      if (data.success) {
        const { token: authToken, user: userData } = data.data;
        
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
        return;
      } else {
        console.error('❌ API returned success=false:', data);
        throw new Error(data.error?.message || 'Login failed');
      }
    } catch (error: any) {
      console.error('❌ Login error caught:', error);
      console.error('Error message:', error.message);
      
      // Fallback to local authentication with plain password
      console.log('🔄 Falling back to local authentication with plain password...');
      
      // Local user database with plain passwords
      const localUsers = [
        {
          id: '1',
          name: 'Touqeer Admin',
          email: 'admin@fitnix.com',
          password: 'password123', // Plain password
          role: 'GYM_ADMIN',
          gymId: 'gym-1',
          gymName: 'FitNix Elite Gym',
        },
      ];
      
      const user = localUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
      
      if (!user) {
        console.error('❌ User not found');
        throw new Error('Invalid email or password');
      }
      
      // Plain password comparison (no hashing)
      if (user.password !== password) {
        console.error('❌ Password mismatch');
        throw new Error('Invalid email or password');
      }
      
      // Generate a simple token for local auth
      const authToken = `local_token_${Date.now()}_${user.id}`;
      
      const userData = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        gymId: user.gymId,
        gymName: user.gymName,
      };
      
      // Store token and user
      localStorage.setItem('token', authToken);
      localStorage.setItem('user', JSON.stringify(userData));
      
      setToken(authToken);
      setUser(userData);
      
      console.log('✅ Local login successful with plain password');
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

