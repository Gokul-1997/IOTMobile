import axios, { AxiosError, CanceledError, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL } from './config';
import { secureTokenStore } from './secureTokenStore';
import { sessionVersion, sessionSignal } from './session';
type SessionRequest = InternalAxiosRequestConfig & { _session?: number; _retried?: boolean };

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

// Fired when the refresh token itself is invalid/expired — the app must
// return to the Login screen. Wired up once from the auth store to avoid
// a circular import between the store and the client.
let onSessionExpired: (() => void) | null = null;
export function registerSessionExpiredHandler(handler: () => void) {
  onSessionExpired = handler;
}

export function expireSession(expectedVersion: number) {
  if (expectedVersion === sessionVersion()) onSessionExpired?.();
}

apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const request = config as SessionRequest;
  const version = request._session ?? sessionVersion();
  if (version !== sessionVersion()) throw new CanceledError('Session changed');
  request._session = version;
  config.signal = config.signal ?? sessionSignal();
  const token = await secureTokenStore.getAccessToken();
  if (version !== sessionVersion()) throw new CanceledError('Session changed');
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

let refreshInFlight: Promise<string | null> | null = null;
let refreshVersion = -1;

async function refreshAccessToken(): Promise<string | null> {
  const version = sessionVersion();
  const refreshToken = await secureTokenStore.getRefreshToken();
  if (!refreshToken || version !== sessionVersion()) return null;

  try {
    const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken }, { timeout: 15000, signal: sessionSignal() });
    const newAccessToken: string = data.accessToken;
    if (version !== sessionVersion()) return null;
    await secureTokenStore.setAccessToken(newAccessToken);
    if (version !== sessionVersion()) return null;
    return newAccessToken;
  } catch (error) {
    if (version !== sessionVersion()) return null;
    if (axios.isAxiosError(error) && [401, 403].includes(error.response?.status ?? 0)) return null;
    throw error; // network failure is not proof that the session expired
  }
}

// Shared by the HTTP 401 path above and the socket TOKEN_EXPIRED path
// (socket.ts) so a near-simultaneous expiry never fires two refresh calls.
export function getRefreshedAccessToken(): Promise<string | null> {
  if (refreshVersion !== sessionVersion()) { refreshInFlight = null; refreshVersion = sessionVersion(); }
  if (!refreshInFlight) {
    const pending = refreshAccessToken().finally(() => { if (refreshInFlight === pending) refreshInFlight = null; });
    refreshInFlight = pending;
  }
  return refreshInFlight;
}

apiClient.interceptors.response.use(
  response => {
    if ((response.config as SessionRequest)._session !== sessionVersion()) throw new CanceledError('Session changed');
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as SessionRequest | undefined;
    if (originalRequest && originalRequest._session !== sessionVersion()) throw new CanceledError('Session changed');

    if (error.response?.status === 401 && originalRequest && !originalRequest._retried && !originalRequest.url?.startsWith('/auth/')) {
      originalRequest._retried = true;

      // Coalesce concurrent 401s (and any concurrent socket refresh) into one call.
      const newToken = await getRefreshedAccessToken();

      if (originalRequest._session !== sessionVersion()) throw new CanceledError('Session changed');
      if (newToken) {
        originalRequest.headers.set('Authorization', `Bearer ${newToken}`);
        return apiClient(originalRequest);
      }

      expireSession(originalRequest._session!);
    }

    return Promise.reject(error);
  }
);
