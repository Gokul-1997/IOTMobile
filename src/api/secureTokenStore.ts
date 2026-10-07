import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'mexa_access_token';
const REFRESH_TOKEN_KEY = 'mexa_refresh_token';
const USER_KEY = 'mexa_user';

// expo-secure-store has no web implementation (no Keychain/Keystore equivalent
// in a browser). On native this wraps the real device Keychain/Keystore; on
// web (dev preview only — the shipped app is native) it falls back to
// localStorage, which is NOT secure storage. Never treat the web path as
// production-equivalent.
const isWeb = Platform.OS === 'web';

async function getItem(key: string): Promise<string | null> {
  if (isWeb) return window.localStorage.getItem(key);
  return SecureStore.getItemAsync(key);
}

async function setItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    window.localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function deleteItem(key: string): Promise<void> {
  if (isWeb) {
    window.localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

// Serialize mutations so an old token write cannot finish after logout clears it.
let mutations: Promise<unknown> = Promise.resolve();
function mutate(work: () => Promise<void>): Promise<void> {
  const next = mutations.then(work, work);
  mutations = next.catch(() => {});
  return next;
}

export const secureTokenStore = {
  async getAccessToken() {
    return getItem(ACCESS_TOKEN_KEY);
  },
  async getRefreshToken() {
    return getItem(REFRESH_TOKEN_KEY);
  },
  async setTokens(accessToken: string, refreshToken: string) {
    await mutate(async () => { await Promise.all([setItem(ACCESS_TOKEN_KEY, accessToken), setItem(REFRESH_TOKEN_KEY, refreshToken)]); });
  },
  async setAccessToken(accessToken: string) {
    await mutate(() => setItem(ACCESS_TOKEN_KEY, accessToken));
  },
  // The backend has no self-profile endpoint (GET /users/:id is admin-only),
  // so the logged-in user's profile is cached locally at sign-in time and
  // restored on app reload rather than re-fetched.
  async getUser<T>(): Promise<T | null> {
    const raw = await getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },
  async setUser(user: unknown) {
    await mutate(() => setItem(USER_KEY, JSON.stringify(user)));
  },
  async clear() {
    await mutate(async () => { await Promise.all([deleteItem(ACCESS_TOKEN_KEY), deleteItem(REFRESH_TOKEN_KEY), deleteItem(USER_KEY)]); });
  },
};
