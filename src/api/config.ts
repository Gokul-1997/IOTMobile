import Constants from 'expo-constants';

// Set per environment via app.json -> expo.extra, or EAS build profile env vars.
// Falls back to local dev backend (Backend/src/server.js listens on 8000).
const extra = Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined;

/*
 * Which server the app talks to, first match wins:
 *  1. EXPO_PUBLIC_API_BASE_URL — set per build in eas.json (production:
 *     https://stmapi.stmcnc.com/api; an on-premise build: the customer's
 *     own server), inlined at build time;
 *  2. app.json -> expo.extra.apiBaseUrl — local development;
 *  3. the local dev backend.
 * A store build that still pointed at localhost could not reach anything
 * from a phone; eas.json's production profile sets (1).
 */
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL || extra?.apiBaseUrl || 'http://localhost:8000/api';

// Socket.IO runs on the same server as the API, one path level up
// (mirrors FrontendIOT/src/environments — same host, no /api suffix).
export const SOCKET_URL = API_BASE_URL.replace(/\/api\/?$/, '');
