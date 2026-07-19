'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import api from '@/lib/api';
import { isJwtExpired } from '@/lib/jwtClient';
import {
  canGymPermission,
  normalizeGymRole,
  normalizePermissionKeys,
  type GymPermissionUser,
} from '@/lib/gymRoles';

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  gymId: string;
  gymName?: string;
  permissionKeys: string[];
  usesLegacyPermissions: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
  /** Permission check for the signed-in user. */
  can: (key: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function normalizeAuthUser(userData: Record<string, unknown>): User {
  return {
    id: String(userData.id ?? ''),
    name: String(userData.name ?? ''),
    email: String(userData.email ?? ''),
    role: normalizeGymRole(userData.role as string),
    gymId: String(userData.gymId ?? ''),
    gymName: (() => {
      if (typeof userData.gymName === 'string' && userData.gymName) return userData.gymName;
      const gym = userData.gym;
      if (gym && typeof gym === 'object' && typeof (gym as { name?: unknown }).name === 'string') {
        return (gym as { name: string }).name;
      }
      return undefined;
    })(),
    permissionKeys: normalizePermissionKeys(userData.permissionKeys),
    usesLegacyPermissions: userData.usesLegacyPermissions === true,
  };
}

function coerceStoredUser(raw: unknown): User | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.id == null) return null;
  return normalizeAuthUser(o);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Proactive sign-out when the access JWT expires, so data requests don't fail with raw "Invalid token" errors.
  // Use window.location (not useRouter) so this module stays a plain client module — useRouter in the root provider
  // can confuse Next's App Router / webpack client chunk graph and trigger "__webpack_modules__[id] is not a function".
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const syncExpiredSession = () => {
      const t = localStorage.getItem('token');
      if (!t || !t.startsWith('eyJ') || !isJwtExpired(t)) return;
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
      setToken(null);
      if (window.location.pathname !== '/login') {
        window.location.replace('/login?session=expired');
      }
    };

    syncExpiredSession();
    const interval = window.setInterval(syncExpiredSession, 45_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') syncExpiredSession();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // Check for existing session on mount
  useEffect(() => {
    const checkAuth = async () => {
      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');

      if (storedToken && storedUser) {
        try {
          // Check if token is JWT (from external API) or local token
          const isJWT = storedToken.startsWith('eyJ');
          
          if (isJWT) {
            // JWT token - validate with external API directly
            console.log('🔵 Validating JWT token with external API...');
            try {
              const apiResponse = await api.get('/api/auth/me');
              if (apiResponse.data.success) {
                const userData = apiResponse.data.data;
                const normalizedUser = normalizeAuthUser(
                  userData && typeof userData === 'object' ? userData : {}
                );
                setUser(normalizedUser);
                setToken(storedToken);
                // Update stored user data in case it changed
                localStorage.setItem('user', JSON.stringify(normalizedUser));
                console.log('✅ JWT token validated successfully');
              } else {
                // Token invalid, clear storage
                console.error('❌ JWT token validation failed - API returned success=false');
                localStorage.removeItem('token');
                localStorage.removeItem('user');
              }
            } catch (apiError: any) {
              // If it's a 401, token is invalid - clear storage
              if (apiError.response?.status === 401) {
                console.error('❌ JWT token invalid (401) - clearing storage');
                localStorage.removeItem('token');
                localStorage.removeItem('user');
              } else {
                // Network error or other issue - restore from localStorage
                console.warn('⚠️ Token validation failed but restoring from localStorage:', apiError.message);
                try {
                  const parsedUser = coerceStoredUser(JSON.parse(storedUser));
                  if (parsedUser) {
                    setUser(parsedUser);
                    setToken(storedToken);
                  } else {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                  }
                } catch (parseError) {
                  console.error('❌ Failed to parse stored user data');
                  localStorage.removeItem('token');
                  localStorage.removeItem('user');
                }
              }
            }
          } else {
            // Local token - validate with Next.js API route
            console.log('🔵 Validating local token with Next.js API route...');
            const response = await fetch('/api/auth/me', {
              headers: {
                'Authorization': `Bearer ${storedToken}`,
              },
            });
            
            if (response.ok) {
              const data = await response.json();
              if (data.success) {
                const userData = data.data;
                const normalizedUser = normalizeAuthUser(
                  userData && typeof userData === 'object' ? userData : {}
                );
                setUser(normalizedUser);
                setToken(storedToken);
                localStorage.setItem('user', JSON.stringify(normalizedUser));
                console.log('✅ Local token validated successfully');
              } else {
                // Token invalid, clear storage
                console.error('❌ Local token validation failed - API returned success=false');
                localStorage.removeItem('token');
                localStorage.removeItem('user');
              }
            } else {
              // Token invalid, clear storage
              console.error('❌ Local token validation failed - response not OK');
              localStorage.removeItem('token');
              localStorage.removeItem('user');
            }
          }
        } catch (error) {
          // Unexpected error - restore from localStorage as fallback
          console.error('⚠️ Token validation error (restoring from localStorage):', error);
          try {
            const parsedUser = coerceStoredUser(JSON.parse(storedUser));
            if (parsedUser) {
              setUser(parsedUser);
              setToken(storedToken);
            } else {
              localStorage.removeItem('token');
              localStorage.removeItem('user');
            }
          } catch (parseError) {
            console.error('❌ Failed to parse stored user data');
            localStorage.removeItem('token');
            localStorage.removeItem('user');
          }
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const login = async (username: string, password: string) => {
    try {
      // Try Next.js API route first (uses plain password comparison)
      console.log('🔵 Attempting login with Next.js API route (plain password)...');
      console.log('Request payload:', { email: username, password: '***' });
      
      // Send plain password (no encoding/hashing) to API
      // Send username value as 'email' in payload
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: username, password }), // Plain password sent as-is, username sent as email
      });
      
      const data = await response.json();
      
      console.log('✅ Login API Response received:', data);
      console.log('Response status:', response.status);

      if (data.success) {
        const { token: authToken, user: userData } = data.data;
        
        console.log('Token received:', authToken ? 'Yes' : 'No');
        console.log('User data received:', userData);
        
        const normalizedUser = normalizeAuthUser(
          userData && typeof userData === 'object' ? userData : {}
        );
        
        // Store token and user
        localStorage.setItem('token', authToken);
        localStorage.setItem('user', JSON.stringify(normalizedUser));
        
        setToken(authToken);
        setUser(normalizedUser);
        
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
          username: 'admin',
          email: 'admin@fitnix.com',
          password: 'password123', // Plain password
          role: 'GYM_ADMIN',
          gymId: 'gym-1',
          gymName: 'FitNix Elite Gym',
          permissionKeys: [] as string[],
          usesLegacyPermissions: false,
        },
      ];
      
      const localUser = localUsers.find(u => u.username.toLowerCase() === username.toLowerCase());
      
      if (!localUser) {
        console.error('❌ User not found');
        throw new Error('Invalid username or password');
      }
      
      // Plain password comparison (no hashing)
      if (localUser.password !== password) {
        console.error('❌ Password mismatch');
        throw new Error('Invalid username or password');
      }
      
      // Generate a simple token for local auth
      const authToken = `local_token_${Date.now()}_${localUser.id}`;
      
      const userData = normalizeAuthUser({
        id: localUser.id,
        name: localUser.name,
        email: localUser.email,
        role: localUser.role,
        gymId: localUser.gymId,
        gymName: localUser.gymName,
        permissionKeys: localUser.permissionKeys,
        usesLegacyPermissions: localUser.usesLegacyPermissions,
      });
      
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

  const can = useCallback(
    (key: string) => canGymPermission(user as GymPermissionUser | null, key),
    [user]
  );

  const value = useMemo(
    () => ({ user, token, login, logout, loading, can }),
    [user, token, loading, can]
  );

  return (
    <AuthContext.Provider value={value}>
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
