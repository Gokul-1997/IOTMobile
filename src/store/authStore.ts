import { create } from 'zustand';
import * as authApi from '../api/auth';
import { registerSessionExpiredHandler } from '../api/client';
import { secureTokenStore } from '../api/secureTokenStore';
import { disconnectSocket } from '../api/socket';
import { AuthUser } from '../types/auth';
import { invalidateSessionRequests, sessionVersion } from '../api/session';

interface AuthState {
  user: AuthUser | null;
  status: 'checking' | 'signedOut' | 'signedIn';
  error: string | null;
  bootstrap: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  status: 'checking',
  error: null,

  // Called once on app start: if a token exists we trust it optimistically —
  // the first authenticated API call will refresh/clear it if invalid.
  // The user profile is restored from the local cache saved at sign-in,
  // since there's no self-profile endpoint to re-fetch it from.
  bootstrap: async () => {
    const version = sessionVersion();
    const token = await secureTokenStore.getAccessToken();
    if (version !== sessionVersion()) return;
    if (!token) {
      set({ status: 'signedOut' });
      return;
    }
    const user = await secureTokenStore.getUser<AuthUser>();
    if (version === sessionVersion()) set({ user, status: 'signedIn' });
  },

  signIn: async (email, password) => {
    invalidateSessionRequests();
    disconnectSocket();
    const version = sessionVersion();
    await secureTokenStore.clear();
    if (version !== sessionVersion()) return;
    set({ error: null });
    try {
      const { accessToken, refreshToken, user } = await authApi.login(email, password);
      if (version !== sessionVersion()) return;
      await Promise.all([secureTokenStore.setTokens(accessToken, refreshToken), secureTokenStore.setUser(user)]);
      if (version === sessionVersion()) set({ user, status: 'signedIn' });
    } catch (e: any) {
      const message = e?.response?.data?.message ?? 'Unable to sign in. Please try again.';
      if (version === sessionVersion()) set({ error: message });
      throw e;
    }
  },

  signOut: async () => {
    const refresh = secureTokenStore.getRefreshToken();
    invalidateSessionRequests();
    disconnectSocket();
    const cleared = secureTokenStore.clear();
    set({ user: null, status: 'signedOut' });
    const [refreshToken] = await Promise.all([refresh, cleared]);
    if (refreshToken) {
      authApi.logout(refreshToken).catch(() => {
        // Best-effort server-side revoke; local session is already cleared.
      });
    }
  },
}));

// Wire the API client's 401-after-refresh-failure event to a real sign-out.
registerSessionExpiredHandler(() => {
  invalidateSessionRequests();
  disconnectSocket();
  void secureTokenStore.clear().catch(() => {});
  useAuthStore.setState({ user: null, status: 'signedOut' });
});
