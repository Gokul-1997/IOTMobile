import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from './config';
import { secureTokenStore } from './secureTokenStore';
import { getRefreshedAccessToken, expireSession } from './client';
import { sessionVersion } from './session';

export interface MachineUpdatePayload {
  machine_id: number;
  plant_id: number;
  machine_status?: string;
  alarm?: boolean;
  received_at?: string | number;
}
let socket: Socket | null = null;
let connecting: Promise<void> | null = null;
let cancelConnect: (() => void) | undefined;
let generation = 0;
let refreshing = false;
let machineIds: number[] = [];
const connectedListeners = new Set<() => void>();
const listeners = new Set<(data: MachineUpdatePayload) => void>();

export function connectSocket(): Promise<void> {
  if (socket?.connected) return Promise.resolve();
  if (connecting) return connecting;
  const current = generation;
  const session = sessionVersion();
  const attempt = (async () => {
    const token = await secureTokenStore.getAccessToken();
    if (current !== generation || session !== sessionVersion()) throw new Error('Session changed');
    if (!token) throw new Error('No active session');
    if (!socket) {
      const s = socket = io(SOCKET_URL, {
        transports: ['websocket'], autoConnect: false, reconnection: true,
        reconnectionAttempts: Infinity, reconnectionDelay: 2000,
        reconnectionDelayMax: 30000, randomizationFactor: 0.5, auth: { token }
      });
      s.on('connect', () => { if (socket === s) { refreshing = false; s.emit('subscribeMachines', machineIds); for (const callback of connectedListeners) callback(); } });
      s.on('machineUpdate', data => { for (const callback of listeners) callback(data); });
      s.on('connect_error', async error => {
        if (socket === s && session === sessionVersion() && error.message === 'Unauthorized') { expireSession(session); return; }
        if (error.message !== 'TOKEN_EXPIRED' || refreshing || socket !== s) return;
        refreshing = true;
        try {
          const token = await getRefreshedAccessToken();
          if (socket !== s || session !== sessionVersion()) return;
          if (token) { s.auth = { token }; s.connect(); }
          else { cancelConnect?.(); expireSession(session); }
        } catch { cancelConnect?.(); }
        finally { if (socket === s) refreshing = false; }
      });
    }
    const s = socket;
    await new Promise<void>((resolve, reject) => {
      const done = (error?: Error) => {
        clearTimeout(timeout);
        s.off('connect', connected); s.off('connect_error', failed);
        if (cancelConnect === cancelled) cancelConnect = undefined;
        error ? reject(error) : resolve();
      };
      const connected = () => done();
      const failed = (error: Error) => { if (error.message !== 'TOKEN_EXPIRED') done(error); };
      const cancelled = () => done(new Error('Live connection cancelled'));
      const timeout = setTimeout(() => done(new Error('Live connection timed out')), 15000);
      cancelConnect = cancelled;
      s.on('connect', connected); s.on('connect_error', failed); s.connect();
    });
  })();
  const pending = attempt.finally(() => { if (connecting === pending) connecting = null; });
  connecting = pending;
  return pending;
}

export function onSocketConnected(callback: () => void): () => void {
  connectedListeners.add(callback);
  return () => { connectedListeners.delete(callback); };
}
export function setMachineIds(ids: number[]) {
  machineIds = [...new Set(ids)];
  if (socket?.connected) socket.emit('subscribeMachines', machineIds);
}
export function onMachineUpdate(callback: (data: MachineUpdatePayload) => void): () => void {
  listeners.add(callback);
  return () => { listeners.delete(callback); };
}
export function disconnectSocket(): void {
  generation++;
  cancelConnect?.();
  socket?.removeAllListeners(); socket?.disconnect();
  socket = null; connecting = null; refreshing = false; machineIds = [];
  listeners.clear(); connectedListeners.clear();
}
export async function connectSocketQuietly(): Promise<boolean> {
  try { await connectSocket(); return true; } catch { return false; }
}
