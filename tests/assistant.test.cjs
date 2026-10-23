const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(file, dependencies = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
    return dependencies[name];
  }, module, module.exports);
  return module.exports;
}
const flush = async () => { for (let i = 0; i < 32; i++) await Promise.resolve(); };
const { LatestRequest } = load('src/api/latestRequest.ts');
const initialUser = () => ({ id: 7, company_id: 4, plant_id: 8, auth_revision: 2,
  roles: ['ADMIN'], permissions: [], company_permissions: ['page:assistant:view'] });
const status = (extra = {}) => ({ name: 'Mexa AI', enabled: true, welcome: 'Company assistant',
  allowance: { limit: 50, used: 0, remaining: 50 }, ...extra });
const reply = (extra = {}) => ({ kind: 'answer', text: 'Production is 12 pcs.', sig: 'server-signature', sources: [], ...extra });
function fixture() {
  let current = { user: initialUser(), status: 'signedIn' };
  let authChanged;
  let statusCall = async () => status(), chatCall = async () => reply();
  const calls = { status: 0, chat: 0 };
  const session = load('src/api/session.ts');
  const create = initialize => {
    let state;
    const setState = patch => { state = { ...state, ...patch }; };
    state = initialize(setState, () => state);
    return { getState: () => state, setState };
  };
  const { useAssistantStore } = load('src/store/assistantStore.ts', {
    zustand: { create },
    '../api/assistant': {
      getAssistantStatus: signal => { calls.status++; return statusCall(signal); },
      askAssistant: (messages, signal) => { calls.chat++; return chatCall(messages, signal); },
    },
    '../api/latestRequest': { LatestRequest },
    '../api/session': session,
    '../auth/permissions': { mayUseAssistant: user => !!user?.company_id && !user.is_snt_super && user.company_permissions?.includes('page:assistant:view') },
    './authStore': { useAuthStore: { getState: () => current, subscribe: listener => { authChanged = listener; } } },
  });
  return {
    store: useAssistantStore, get: useAssistantStore.getState, calls, session,
    status: fn => { statusCall = fn; }, chat: fn => { chatCall = fn; },
    auth: patch => { const previous = current; current = { ...current, ...patch }; authChanged(current, previous); },
  };
}

test('history sends exact server signatures, omits local errors and bounds alternating turns', () => {
  const { assistantTurns } = load('src/api/assistant.ts', { './client': {} });
  const turns = assistantTurns([
    { role: 'assistant', text: 'Old unsigned opening' },
    { role: 'user', text: 'Old failed question' },
    { role: 'assistant', text: 'Connection failed', kind: 'error' },
    { role: 'user', text: 'Today’s production?' },
    { role: 'assistant', text: '12 pcs.\n- First shift: 12 pcs.', sig: 'exact-signature' },
    { role: 'assistant', text: 'A local note', kind: 'note' },
    { role: 'user', text: 'And yesterday?' },
  ]);
  assert.deepEqual(turns, [
    { role: 'user', content: 'Today’s production?' },
    { role: 'assistant', content: '12 pcs.\n- First shift: 12 pcs.', sig: 'exact-signature' },
    { role: 'user', content: 'And yesterday?' },
  ]);
  const many = Array.from({ length: 40 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', text: String(i) }));
  const bounded = assistantTurns(many);
  assert.ok(bounded.length <= 12); assert.equal(bounded[0].role, 'user');
});

test('AI API uses authenticated endpoints, passes cancellation and permits the server answer deadline', async () => {
  const calls = [];
  const api = load('src/api/assistant.ts', { './client': { apiClient: {
    get: async (...args) => { calls.push(args); return { data: { data: status() } }; },
    post: async (...args) => { calls.push(args); return { data: { data: reply() } }; },
  } } });
  const controller = new AbortController();
  await api.getAssistantStatus(controller.signal);
  await api.askAssistant([{ role: 'user', text: 'My reports?' }], controller.signal);
  assert.equal(calls[0][0], '/assistant/status');
  assert.equal(calls[1][0], '/assistant/chat');
  assert.deepEqual(calls[1][1], { messages: [{ role: 'user', content: 'My reports?' }] });
  assert.equal(calls[1][2].signal, controller.signal); assert.equal(calls[1][2].timeout, 190000);
});

test('no question can run before a successful enabled status or beyond the allowance', async () => {
  const f = fixture();
  assert.equal(await f.get().send('Hello'), false); assert.equal(f.calls.chat, 0);
  f.status(async () => status({ allowance: { limit: 50, remaining: 0 } }));
  await f.get().fetchStatus();
  assert.equal(await f.get().send('Hello'), false); assert.equal(f.calls.chat, 0);
});

test('one pending question, at most 500 characters, exact signed answer retained', async () => {
  const f = fixture(); await f.get().fetchStatus();
  let finish;
  f.chat(async messages => { assert.equal(messages.at(-1).text.length, 500); return new Promise(resolve => { finish = resolve; }); });
  const sent = f.get().send('x'.repeat(700));
  assert.equal(await f.get().send('Duplicate'), false); assert.equal(f.calls.chat, 1);
  finish(reply()); await sent;
  assert.equal(f.get().messages.length, 2); assert.equal(f.get().messages[1].sig, 'server-signature');
  assert.equal(f.get().sending, false);
});

test('feature switched off aborts the question and erases history; late response cannot restore it', async () => {
  const f = fixture(); await f.get().fetchStatus();
  let finish, signal;
  f.chat((_, s) => { signal = s; return new Promise(resolve => { finish = resolve; }); });
  const sent = f.get().send('Company production?');
  f.status(async () => status({ enabled: false, reason: 'SWITCHED_OFF' }));
  await f.get().fetchStatus();
  assert.equal(signal.aborted, true); assert.equal(f.get().sending, false);
  assert.deepEqual(f.get().messages, []); assert.equal(f.get().status.enabled, false);
  finish(reply()); await sent;
  assert.deepEqual(f.get().messages, []); assert.equal(await f.get().send('No access'), false);
});

test('chat access denied clears company history immediately', async () => {
  const f = fixture(); await f.get().fetchStatus();
  f.chat(async () => { throw { response: { status: 403, data: { message: 'Access removed' } } }; });
  await f.get().send('Production?');
  assert.deepEqual(f.get().messages, []); assert.equal(f.get().status.enabled, false);
});

test('account and authorization revision changes abort pending responses and remove old signatures', async () => {
  for (const patch of [{ company_id: 5 }, { plant_id: 9 }, { auth_revision: 3 }, { company_permissions: [] }]) {
    const f = fixture(); await f.get().fetchStatus();
    let finish, signal;
    f.chat((_, s) => { signal = s; return new Promise(resolve => { finish = resolve; }); });
    const sent = f.get().send('Company production?');
    f.auth({ user: { ...initialUser(), ...patch } });
    assert.equal(signal.aborted, true); assert.deepEqual(f.get().messages, []); assert.equal(f.get().status, null);
    finish(reply()); await sent; assert.deepEqual(f.get().messages, []);
  }
});

test('old-company status is discarded when sign-out happens before its response', async () => {
  const f = fixture(); let finish, signal;
  f.status(s => { signal = s; return new Promise(resolve => { finish = resolve; }); });
  const pending = f.get().fetchStatus(); await flush();
  f.auth({ status: 'signedOut', user: null });
  assert.equal(signal.aborted, true);
  finish(status()); await pending;
  assert.equal(f.get().status, null); assert.deepEqual(f.get().messages, []);
});

test('new chat cancels a question without appending a late reply', async () => {
  const f = fixture(); await f.get().fetchStatus(); let finish, signal;
  f.chat((_, s) => { signal = s; return new Promise(resolve => { finish = resolve; }); });
  const pending = f.get().send('First question'); f.get().newChat();
  assert.equal(signal.aborted, true); assert.equal(f.get().sending, false);
  finish(reply()); await pending; assert.deepEqual(f.get().messages, []);
});

test('retry replaces an error and reuses its original question once', async () => {
  const f = fixture(); await f.get().fetchStatus();
  f.chat(async () => { throw Error('Network'); });
  await f.get().send('Today’s production?');
  const failed = f.get().messages.at(-1); assert.equal(failed.kind, 'error');
  f.chat(async messages => { assert.equal(messages.filter(m => m.role === 'user').length, 1); return reply(); });
  await f.get().retry(failed.id);
  assert.equal(f.get().messages.length, 2); assert.equal(f.get().messages[1].kind, 'answer');
});

test('a stale status read cannot restore an allowance already consumed by an answer', async () => {
  const f = fixture(); await f.get().fetchStatus(); let finish;
  f.status(() => new Promise(resolve => { finish = resolve; }));
  const refresh = f.get().fetchStatus(); await flush();
  f.chat(async () => reply({ allowance: { limit: 50, remaining: 49, used: 1 } }));
  await f.get().send('Today’s production?');
  finish(status()); await refresh;
  assert.equal(f.get().status.allowance.remaining, 49);
});

test('a failed status refresh disables send until a fresh successful check', async () => {
  const f = fixture(); await f.get().fetchStatus();
  f.status(async () => { throw Error('Offline'); });
  await f.get().fetchStatus(); assert.equal(f.get().unavailable, true);
  assert.equal(await f.get().send('Today’s production?'), false);
  f.status(async () => status()); await f.get().fetchStatus();
  assert.equal(f.get().unavailable, false); assert.equal(await f.get().send('Today’s production?'), true);
});
