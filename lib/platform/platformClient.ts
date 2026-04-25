/**
 * Platform API client — uses JWT in sessionStorage only (never gym localStorage token).
 * Requests are same-origin `/api/platform/...` and proxied to NEXT_PUBLIC_API_URL.
 *
 * Security note: storing JWT in sessionStorage survives tab refresh but not a new tab;
 * it is XSS-exposed if the app has script injection bugs. httpOnly cookies require a BFF.
 * Do not persist gym passwords; platform login password is only held in form state until submit.
 */
import axios, { type AxiosResponse } from 'axios';
import { isJwtExpired } from '@/lib/jwtClient';
import { PLATFORM_TOKEN_KEY, PLATFORM_USER_KEY } from './constants';
import type { PlatformApiEnvelope } from './types';
import { PlatformApiError } from './errors';

export function readPlatformToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(PLATFORM_TOKEN_KEY);
}

export function writePlatformSession(token: string, userJson: string) {
  sessionStorage.setItem(PLATFORM_TOKEN_KEY, token);
  sessionStorage.setItem(PLATFORM_USER_KEY, userJson);
}

export function clearPlatformSession() {
  sessionStorage.removeItem(PLATFORM_TOKEN_KEY);
  sessionStorage.removeItem(PLATFORM_USER_KEY);
}

const platformClient = axios.create({
  baseURL: '',
  headers: { 'Content-Type': 'application/json' },
});

platformClient.interceptors.request.use((config) => {
  const token = readPlatformToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

platformClient.interceptors.response.use(
  (r) => r,
  (error) => {
    if (typeof window === 'undefined') return Promise.reject(error);
    const status = error.response?.status;
    if (status === 401) {
      const path = window.location.pathname;
      if (path.startsWith('/platform') && !path.startsWith('/platform/login')) {
        const tok = readPlatformToken();
        const likelyExpiry = !tok || (tok.startsWith('eyJ') && isJwtExpired(tok));
        clearPlatformSession();
        window.location.href = likelyExpiry
          ? '/platform/login?session=expired'
          : '/platform/login?session=invalid';
      }
    }
    return Promise.reject(error);
  }
);

export function assertPlatformSuccess<T>(res: AxiosResponse<PlatformApiEnvelope<T>>): T {
  const body = res.data;
  if (!body.success) {
    const e = body.error;
    throw new PlatformApiError(res.status, e?.code, e?.message, e?.details);
  }
  return body.data;
}

export default platformClient;
