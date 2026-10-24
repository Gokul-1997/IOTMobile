import { create } from 'zustand';
import * as authApi from '../api/auth';
import { registerSessionExpiredHandler, registerSessionRefreshedHandler } from '../api/client';
import { secureTokenStore } from '../api/secureTokenStore';
import { disconnectSocket } from '../api/socket';
import { AuthUser } from '../types/auth';
import { invalidateSessionRequests, sessionVersion } from '../api/session';

interface AuthState {
  user: AuthUser | null;
  status: 'checking' | 'signedOut' | 'signedIn';
  error: string | null;
  authorizationVersion: number;
  bootstrap: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  status: 'checking',
  error: null,
  authorizationVersion: 0,

  // Called once on app start: if a token exists we trust it optimistically —
  // the first authenticated API call will refresh/clear it if invalid.
  // The user profile is restored from the local cache saved at sign-in,
  // since the basic profile endpoint does not return the role/company grants.
  bootstrap: async () => {
    const version = sessionVersion();
    try {
      const token = await secureTokenStore.getAccessToken();
      if (version !== sessionVersion()) return;
      if (!token) { set({ user: null, status: 'signedOut' }); return; }
      const user = await secureTokenStore.getUser<AuthUser>();
      if (version !== sessionVersion()) return;
      if (!user?.id || !Array.isArray(user.roles) || !Array.isArray(user.permissions)) {
        await secureTokenStore.clear().catch(() => {});
        if (version === sessionVersion()) set({ user: null, status: 'signedOut' });
        return;
      }
      set({ user, status: 'signedIn' });
    } catch {
      // Keychain/Keystore can be temporarily unavailable. Always leave the
      // splash/checking state without exposing a partially restored session.
      if (version === sessionVersion()) set({ user: null, status: 'signedOut', error: 'Unable to restore sign-in. Please sign in again.' });
    }
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

function authorizationKey(user: AuthUser): string {
  return JSON.stringify([user.company_id, user.plant_id, user.user_type, user.is_snt_super,
    [...(user.roles ?? [])].sort(), [...(user.permissions ?? [])].sort(),
    Array.isArray(user.company_permissions) ? [...user.company_permissions].sort() : user.company_permissions]);
}

registerSessionRefreshedHandler((user, version) => {
  const current = useAuthStore.getState();
  if (version !== sessionVersion() || current.status !== 'signedIn' || current.user?.id !== user.id) return;
  const changed = authorizationKey(current.user) !== authorizationKey(user);
  if (changed) {
    invalidateSessionRequests();
    disconnectSocket();
  }
  useAuthStore.setState({ user, authorizationVersion: current.authorizationVersion + (changed ? 1 : 0) });
});
