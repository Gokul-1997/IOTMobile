const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(file, dependencies) {
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
  }).outputText;
  new Function('require', 'module', 'exports', source)(name => {
    if (!(name in dependencies)) throw Error(name);
    return dependencies[name];
  }, module, module.exports);
  return module.exports;
}
function fixture(storage) {
  const session = load('src/api/session.ts', {});
  const create = init => {
    let state;
    const setState = next => { state = { ...state, ...next }; };
    state = init(setState, () => state);
    return { getState: () => state, setState };
  };
  const { useAuthStore } = load('src/store/authStore.ts', {
    zustand: { create }, '../api/auth': {},
    '../api/client': { registerSessionExpiredHandler() {}, registerSessionRefreshedHandler() {} },
    '../api/socket': { disconnectSocket() {} }, '../api/session': session,
    '../api/secureTokenStore': { secureTokenStore: storage }
  });
  return { store: useAuthStore, session };
}
test('unavailable secure storage exits checking safely instead of leaving the splash forever', async () => {
  const f = fixture({ getAccessToken: async () => { throw Error('Keystore unavailable'); } });
  await f.store.getState().bootstrap();
  assert.equal(f.store.getState().status, 'signedOut');
  assert.equal(f.store.getState().user, null);
});
for (const user of [null, {}, { id: 7, roles: 'ADMIN', permissions: [] }]) {
  test(`a token with missing/corrupt cached authorization never opens a partial session: ${JSON.stringify(user)}`, async () => {
    let cleared = 0;
    const f = fixture({ getAccessToken: async () => 'test-token', getUser: async () => user, clear: async () => { cleared++; } });
    await f.store.getState().bootstrap();
    assert.equal(f.store.getState().status, 'signedOut'); assert.equal(cleared, 1);
  });
}
test('a stale bootstrap cannot overwrite a newly signed-in account', async () => {
  let restore;
  const f = fixture({ getAccessToken: () => new Promise(resolve => { restore = resolve; }) });
  const pending = f.store.getState().bootstrap();
  f.session.invalidateSessionRequests();
  const user = { id: 9, roles: ['ADMIN'], permissions: [] };
  f.store.setState({ status: 'signedIn', user });
  restore('old-token'); await pending;
  assert.equal(f.store.getState().user, user);
});
test('a valid cached authorization is restored without another API request', async () => {
  const user = { id: 7, roles: ['ADMIN'], permissions: [], company_id: 4 };
  const f = fixture({ getAccessToken: async () => 'test-token', getUser: async () => user });
  await f.store.getState().bootstrap();
  assert.equal(f.store.getState().status, 'signedIn'); assert.equal(f.store.getState().user, user);
});
