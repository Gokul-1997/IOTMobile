const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const ts = require('typescript');
function load(file, mocks) {
  const source = fs.readFileSync(path.join(__dirname, '../', file), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} };
  new Function('exports', 'require', 'module', code)(mod.exports, name => {
    if (!(name in mocks)) throw new Error('Unexpected import: ' + name);
    return mocks[name];
  }, mod);
  return mod.exports;
}
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture(token = async () => 'token') {
  const created = [];
  let refresh = async () => 'refreshed', expired = 0;
  const session = load('src/api/session.ts', {});
  class FakeSocket extends EventEmitter {
    connected = false;
    attempts = 0;
    auth = {};
    connect() { this.attempts++; return this; }
    disconnect() { this.connected = false; }
    connectedNow() { this.connected = true; this.emit('connect'); }
  }
  const socket = load('src/api/socket.ts', {
    'socket.io-client': { io: () => { const s = new FakeSocket(); created.push(s); return s; } },
    './config': { SOCKET_URL: 'unused' },
    './secureTokenStore': { secureTokenStore: { getAccessToken: token } },
    './client': { getRefreshedAccessToken: () => refresh(), expireSession: () => { expired++; } },
    './session': session
  });
  return { socket, session, created, expired: () => expired, setRefresh: fn => { refresh = fn; } };
}

test('logout invalidates socket creation while token storage is pending', async () => {
  let release;
  const f = fixture(() => new Promise(resolve => { release = resolve; }));
  const attempt = f.socket.connectSocket();
  f.socket.disconnectSocket();
  release('old-token');
  await assert.rejects(attempt, /Session changed/);
  assert.equal(f.created.length, 0);
});

test('concurrent connects share a promise and each subscriber owns its cleanup', async () => {
  const f = fixture();
  const a = [], b = [];
  const removeA = f.socket.onMachineUpdate(data => a.push(data.machine_id));
  const removeB = f.socket.onMachineUpdate(data => b.push(data.machine_id));
  const first = f.socket.connectSocket();
  assert.equal(f.socket.connectSocket(), first);
  await tick();
  f.created[0].connectedNow(); await first;
  f.created[0].emit('machineUpdate', { machine_id: 7 });
  removeA();
  f.created[0].emit('machineUpdate', { machine_id: 8 });
  assert.deepEqual(a, [7]); assert.deepEqual(b, [7, 8]);
  assert.equal(f.created[0].listenerCount('connect_error'), 1);
  removeB(); f.socket.disconnectSocket();
});

test('refresh failure settles a pending connection instead of hanging', async () => {
  const f = fixture(); f.setRefresh(async () => null);
  const attempt = f.socket.connectSocket();
  const result = assert.rejects(attempt, /cancelled/);
  await tick();
  f.created[0].emit('connect_error', new Error('TOKEN_EXPIRED'));
  await result;
  assert.equal(f.expired(), 1);
  f.socket.disconnectSocket();
});

test('a refresh from the old session cannot reconnect after logout', async () => {
  const f = fixture(); let release;
  f.setRefresh(() => new Promise(resolve => { release = resolve; }));
  const attempt = f.socket.connectSocket();
  const result = assert.rejects(attempt, /cancelled/);
  await tick();
  const old = f.created[0];
  old.emit('connect_error', new Error('TOKEN_EXPIRED'));
  f.session.invalidateSessionRequests(); f.socket.disconnectSocket();
  release('old-refreshed-token'); await result; await tick();
  assert.equal(old.attempts, 1); assert.equal(old.connected, false);
  assert.equal(f.expired(), 0);
});

test('session reset aborts old requests and creates a fresh signal', () => {
  const session = load('src/api/session.ts', {});
  const old = session.sessionSignal(); const version = session.sessionVersion();
  session.invalidateSessionRequests();
  assert.equal(old.aborted, true);
  assert.equal(session.sessionSignal().aborted, false);
  assert.equal(session.sessionVersion(), version + 1);
});

test('HTTP session expiry disconnects sockets and clears credentials', async () => {
  let expired, disconnected = 0, cleared = 0;
  const session = load('src/api/session.ts', {});
  const create = initializer => {
    let state;
    const set = next => { state = { ...state, ...next }; };
    state = initializer(set, () => state);
    return { setState: set, getState: () => state };
  };
  const { useAuthStore } = load('src/store/authStore.ts', {
    zustand: { create }, '../api/auth': {},
    '../api/client': { registerSessionExpiredHandler: handler => { expired = handler; } },
    '../api/secureTokenStore': { secureTokenStore: { clear: async () => { cleared++; } } },
    '../api/socket': { disconnectSocket: () => { disconnected++; } },
    '../api/session': session
  });
  useAuthStore.setState({ status: 'signedIn', user: { id: 7 } });
  const oldSignal = session.sessionSignal();
  expired(); await tick();
  assert.equal(useAuthStore.getState().status, 'signedOut');
  assert.equal(useAuthStore.getState().user, null);
  assert.equal(disconnected, 1); assert.equal(cleared, 1); assert.equal(oldSignal.aborted, true);
});

function httpFixture() {
  const session = load('src/api/session.ts', {});
  let request, success, failure, expired = 0, writes = 0;
  let refresh = async () => ({ data: { accessToken: 'new-token' } });
  const api = Object.assign(async config => config, { interceptors: {
    request: { use: fn => { request = fn; } },
    response: { use: (ok, bad) => { success = ok; failure = bad; } }
  } });
  class CanceledError extends Error { code = 'ERR_CANCELED'; }
  const axios = { create: () => api, post: (...args) => refresh(...args), isAxiosError: error => !!error.response };
  const client = load('src/api/client.ts', {
    axios: { __esModule: true, default: axios, CanceledError }, './config': { API_BASE_URL: 'unused' }, './session': session,
    './secureTokenStore': { secureTokenStore: {
      getAccessToken: async () => 'token', getRefreshToken: async () => 'refresh',
      setAccessToken: async () => { writes++; }
    } }
  });
  client.registerSessionExpiredHandler(() => { expired++; });
  return { session, client, request: config => request(config), success: response => success(response),
    failure: error => failure(error), setRefresh: fn => { refresh = fn; }, writes: () => writes, expired: () => expired };
}

test('old HTTP responses and pending refreshes cannot enter a new session', async () => {
  const f = httpFixture();
  const request = await f.request({ url: '/dashboard', headers: { set() {} } });
  let reply;
  f.setRefresh(() => new Promise(resolve => { reply = resolve; }));
  const refresh = f.client.getRefreshedAccessToken(); await tick();
  f.session.invalidateSessionRequests();
  assert.throws(() => f.success({ config: request }), /Session changed/);
  reply({ data: { accessToken: 'old-refreshed-token' } });
  assert.equal(await refresh, null); assert.equal(f.writes(), 0);
});

test('a refresh network outage does not sign the user out', async () => {
  const f = httpFixture();
  const request = await f.request({ url: '/dashboard', headers: { set() {} } });
  f.setRefresh(async () => { throw new Error('network interrupted'); });
  await assert.rejects(f.failure({ config: request, response: { status: 401 } }), /network interrupted/);
  assert.equal(f.expired(), 0);
});

test('session expiry from an old request cannot log out the current account', () => {
  const f = httpFixture();
  const old = f.session.sessionVersion();
  f.session.invalidateSessionRequests();
  f.client.expireSession(old);
  assert.equal(f.expired(), 0);
  f.client.expireSession(f.session.sessionVersion());
  assert.equal(f.expired(), 1);
});

test('telemetry timestamps preserve server seconds instead of snapshot fetch time', () => {
  const { telemetrySeconds } = load('src/api/telemetryTime.ts', {});
  assert.equal(telemetrySeconds(1700000000), 1700000000);
  assert.equal(telemetrySeconds('1700000000'), 1700000000);
  assert.equal(telemetrySeconds('2023-11-14T22:13:20.000Z'), 1700000000);
  for (const value of [null, undefined, '', 'invalid', NaN, 0]) assert.equal(telemetrySeconds(value), null);
});

test('credential clearing waits for an earlier asynchronous token write', async () => {
  const values = new Map(); let finishWrite;
  const store = load('src/api/secureTokenStore.ts', {
    'react-native': { Platform: { OS: 'ios' } },
    'expo-secure-store': {
      getItemAsync: async key => values.get(key) ?? null,
      setItemAsync: (key, value) => new Promise(resolve => { finishWrite = () => { values.set(key, value); resolve(); }; }),
      deleteItemAsync: async key => { values.delete(key); }
    }
  }).secureTokenStore;
  const write = store.setAccessToken('old-token'); await tick();
  const clear = store.clear();
  finishWrite(); await Promise.all([write, clear]);
  assert.equal(await store.getAccessToken(), null);
});
