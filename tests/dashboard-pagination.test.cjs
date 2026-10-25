const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Execute the actual screen and JSX callbacks without a native renderer,
// network or credentials. State updates/effect cleanup behave across renders.
const compiled = new Map();
function load(file, resolve = () => { throw Error('Unexpected dependency'); }) {
  if (!compiled.has(file)) compiled.set(file, new Function('require', 'module', 'exports', ts.transpileModule(
    fs.readFileSync(path.join(__dirname, '..', file), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }
  ).outputText));
  const module = { exports: {} }; compiled.get(file)(resolve, module, module.exports); return module.exports;
}
const access = load('src/auth/permissions.ts');
const time = load('src/api/telemetryTime.ts');
const microtasks = async () => { for (let i = 0; i < 32; i++) await Promise.resolve(); };
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

function pageData(page, { total = 13, ids, received = Date.now() / 1000 } = {}) {
  return { status: 'success', shift: null, summary: { total, running: total, idle: 0, offline: 0, alarm: 0 },
    pagination: { page, per_page: 6, total, total_pages: Math.max(1, Math.ceil(total / 6)) },
    machines: (ids ?? Array.from({ length: Math.max(0, Math.min(6, total - (page - 1) * 6)) }, (_, i) => (page - 1) * 6 + i + 1))
      .map(id => ({ machine_id: id, machine_serial_no: `CNC-${id}`, status: 'RUNNING', alarm: false,
        received_at: received, utilization: 50, run_time: '01:00', idle_time: '00:00' })) };
}

function fixture(t, handler = options => pageData(options.page)) {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 1_800_000_000_000 });
  const values = [], effects = [], queue = [];
  let cursor = 0, dirty = true, tree, mounted = true, active = true, allowed = true;
  let user = { id: 1, company_id: 4, plant_id: null, username: 'Fixture', roles: ['COMPANY_ADMIN'], permissions: [], company_permissions: [], auth_revision: 0 };
  let respond = handler;
  const calls = [], subscriptions = [], listeners = new Set();
  const same = (a, b) => !!a && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const react = {
    Fragment: 'Fragment', createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initial) { const i = cursor++; if (!(i in values)) values[i] = typeof initial === 'function' ? initial() : initial;
      return [values[i], value => { const next = typeof value === 'function' ? value(values[i]) : value; if (!Object.is(next, values[i])) { values[i] = next; dirty = true; } }]; },
    useRef(initial) { const i = cursor++; return values[i] ??= { current: initial }; },
    useCallback(fn, deps) { const i = cursor++; if (!same(values[i]?.deps, deps)) values[i] = { deps, fn }; return values[i].fn; },
    useMemo(fn, deps) { const i = cursor++; if (!same(values[i]?.deps, deps)) values[i] = { deps, value: fn() }; return values[i].value; },
    useEffect(fn, deps) { const i = cursor++; if (!same(effects[i]?.deps, deps)) queue.push({ i, fn, deps }); }
  };
  const components = new Proxy({}, { get: (_target, name) => String(name) });
  const { DashboardScreen } = load('src/screens/dashboard/DashboardScreen.tsx', name => {
    if (name === 'react') return react;
    if (name === 'react-native') return components;
    if (name === '@react-navigation/native') return { useNavigation: () => ({}), useIsFocused: () => active };
    if (name === '../../hooks/useAppActive') return { useAppActive: () => active };
    if (name === '../../theme/ThemeProvider') return { useTheme: () => ({ spacing: {}, colors: {}, radius: {}, font: {}, weight: {}, textScale: {} }) };
    if (name === '../../store/authStore') return { useAuthStore: selector => selector({ user }) };
    if (name === '../../auth/permissions') return { ...access, hasPermission: (...args) => allowed && access.hasPermission(...args) };
    if (name === '../../api/dashboard') return { DASHBOARD_PAGE_SIZE: 6, getDashboard: async options => { calls.push(options); return respond(options); } };
    if (name === '../../api/telemetryTime') return time;
    if (name === '../../api/socket') return {
      connectSocketQuietly: async () => true, setMachineIds: ids => { assert.ok(ids.length <= 100); subscriptions.push([...ids]); },
      onMachineUpdate: listener => { listeners.add(listener); return () => listeners.delete(listener); },
      onSocketConnected: () => () => {}
    };
    if (name.startsWith('../../components/') || name === '@expo/vector-icons/Ionicons' || name === '../../theme/colors') return components;
    throw Error('Unexpected import: ' + name);
  });
  function render() {
    if (!mounted) return;
    let count = 0;
    do {
      assert.ok(++count < 50, 'render/effect loop'); dirty = false; cursor = 0; tree = DashboardScreen();
      const pending = queue.splice(0);
      for (const { i } of pending) effects[i]?.cleanup?.();
      for (const { i, fn, deps } of pending) effects[i] = { deps, cleanup: fn() };
    } while (dirty);
  }
  const settle = async () => { for (let i = 0; i < 4; i++) { await microtasks(); if (dirty) render(); } };
  function find(type, root = tree) {
    if (!root || typeof root !== 'object') return null;
    if (root.type === type) return root;
    // Footer/header/empty and RefreshControl are JSX props, not children.
    for (const value of Object.values(root.props ?? {}).flat(Infinity)) {
      if (value && typeof value === 'object' && value !== root) { const found = find(type, value); if (found) return found; }
    }
    return null;
  }
  const list = () => { const node = find('FlatList'); assert.ok(node, 'FlatList should be present'); return node.props; };
  const ids = () => list().data.map(machine => machine.machine_id);
  const close = () => { if (!mounted) return; mounted = false; for (const effect of effects) effect?.cleanup?.(); };
  t.after(close);
  render();
  return { calls, subscriptions, settle, list, ids, find, close,
    respond: fn => { respond = fn; },
    more: () => list().onEndReached(),
    refresh: () => list().refreshControl.props.onRefresh(),
    filter: value => { find('StatusFilter').props.onChange(value); render(); },
    search: async value => { find('TextInput').props.onChangeText(value); render(); t.mock.timers.tick(300); await settle(); },
    scope: patch => { user = { ...user, ...patch }; render(); },
    deny: () => { allowed = false; render(); },
    active: value => { active = value; render(); },
    tick: async ms => { t.mock.timers.tick(ms); await settle(); },
    visible: async ids => { list().onViewableItemsChanged({ viewableItems: ids.map(id => ({ isViewable: true, item: { machine_id: id } })) }); t.mock.timers.tick(200); await settle(); },
    event: update => { for (const listener of listeners) listener(update); }
  };
}

test('scroll appends the next six once, retains previous cards and stops after the final page', async t => {
  const f = fixture(t); await f.settle(); assert.deepEqual(f.ids(), [1, 2, 3, 4, 5, 6]);
  const next = deferred(); f.respond(options => options.page === 2 ? next.promise : pageData(options.page));
  const pending = f.more(); await f.more();
  assert.deepEqual(f.calls.map(call => call.page), [1, 2]);
  assert.deepEqual(f.ids(), [1, 2, 3, 4, 5, 6]);
  next.resolve(pageData(2)); await pending; await f.settle(); assert.equal(f.ids().length, 12);
  f.respond(options => pageData(options.page)); await f.more(); await f.settle();
  assert.equal(f.ids().length, 13); await f.more(); await f.more();
  assert.deepEqual(f.calls.map(call => call.page), [1, 2, 3]);
});

test('a failed append retains cards and retries the same page without automatic retry storms', async t => {
  const f = fixture(t); await f.settle(); f.respond(async () => { throw Error('offline'); });
  await f.more(); await f.settle(); assert.equal(f.ids().length, 6);
  await f.more(); assert.deepEqual(f.calls.map(call => call.page), [1, 2]);
  f.respond(options => pageData(options.page));
  await f.find('Button', f.list().ListFooterComponent).props.onPress(); await f.settle();
  assert.equal(f.ids().length, 12); assert.deepEqual(f.calls.map(call => call.page), [1, 2, 2]);
});

test('pull refresh cancels an append and restarts from six; its late response cannot restore old rows', async t => {
  const f = fixture(t); await f.settle(); const late = deferred();
  f.respond(options => options.page === 2 ? late.promise : pageData(options.page, { ids: [101, 102, 103, 104, 105, 106] }));
  const pending = f.more(); const signal = f.calls.at(-1).signal;
  await f.refresh(); await f.settle(); assert.equal(signal.aborted, true);
  assert.deepEqual(f.ids(), [101, 102, 103, 104, 105, 106]);
  late.resolve(pageData(2)); await pending; await f.settle();
  assert.deepEqual(f.ids(), [101, 102, 103, 104, 105, 106]);
});

test('filter changes cancel the old page, reject retained callbacks and ignore late replies', async t => {
  const f = fixture(t); await f.settle(); const oldMore = f.list().onEndReached, oldRefresh = f.list().refreshControl.props.onRefresh;
  const late = deferred(); f.respond(options => options.status === 'all' ? late.promise : pageData(1, { ids: [20, 21] }));
  const pending = f.more(); const signal = f.calls.at(-1).signal;
  f.filter('RUNNING'); await f.settle(); assert.equal(signal.aborted, true);
  assert.deepEqual(f.ids(), [20, 21]); assert.equal(f.calls.at(-1).status, 'running');
  const count = f.calls.length; await oldMore(); await oldRefresh(); await f.settle();
  assert.equal(f.calls.length, count); assert.deepEqual(f.ids(), [20, 21]);
  late.resolve(pageData(2)); await pending; await f.settle(); assert.deepEqual(f.ids(), [20, 21]);
});

test('debounced search resets to page one and does not append the previous search', async t => {
  const f = fixture(t); await f.settle(); const late = deferred();
  f.respond(options => options.search ? pageData(1, { ids: [50] }) : late.promise);
  const pending = f.more(); await f.search(' CNC-50 ');
  assert.equal(f.calls.at(-1).page, 1); assert.equal(f.calls.at(-1).search, 'CNC-50');
  assert.deepEqual(f.ids(), [50]); late.resolve(pageData(2)); await pending; await f.settle(); assert.deepEqual(f.ids(), [50]);
});

test('a company/scope change hides cached data and rejects the previous company response', async t => {
  const f = fixture(t); await f.settle(); const late = deferred(), nextCompany = deferred();
  f.respond(options => options.page === 2 ? late.promise : nextCompany.promise);
  const pending = f.more(); const signal = f.calls.at(-1).signal;
  f.scope({ company_id: 5 }); assert.equal(f.ids().length, 0); assert.equal(signal.aborted, true);
  late.resolve(pageData(2)); await pending; await f.settle();
  assert.equal(f.calls.at(-1).page, 1); assert.deepEqual(f.ids(), []);
  nextCompany.resolve(pageData(1, { ids: [201, 202] })); await f.settle();
  assert.deepEqual(f.ids(), [201, 202]);
});

test('permission denial and a server 403 clear loaded machines and subscriptions', async t => {
  const f = fixture(t); await f.settle();
  f.respond(async () => { throw { response: { status: 403 } }; });
  await f.more(); await f.settle(); assert.equal(f.ids().length, 0); assert.deepEqual(f.subscriptions.at(-1), []);
  f.deny(); assert.equal(f.find('FlatList'), null); assert.ok(f.find('NoAccess'));
});

test('backgrounding cancels the next page and stops polling, then foreground resumes without losing loaded cards', async t => {
  const f = fixture(t); await f.settle(); const late = deferred(); f.respond(() => late.promise);
  const pending = f.more(); const signal = f.calls.at(-1).signal; f.active(false);
  assert.equal(signal.aborted, true); assert.deepEqual(f.subscriptions.at(-1), []);
  await f.tick(60_000); assert.equal(f.calls.length, 2);
  late.resolve(pageData(2)); await pending; await f.settle(); assert.equal(f.ids().length, 6);
  f.respond(options => pageData(options.page)); f.active(true); await f.settle(); assert.equal(f.ids().length, 6);
});

test('overlapping offset pages deduplicate machine IDs and still advance the server page', async t => {
  const f = fixture(t, options => options.page === 2 ? pageData(2, { ids: [6, 7, 8, 9, 10, 11] }) : pageData(options.page));
  await f.settle(); await f.more(); await f.settle(); assert.equal(new Set(f.ids()).size, 11);
  await f.more(); await f.settle(); assert.equal(f.calls.at(-1).page, 3); assert.equal(new Set(f.ids()).size, f.ids().length);
});

test('a long scrolled list subscribes only its viewport and refreshes at most two visible pages', async t => {
  const f = fixture(t, options => pageData(options.page, { total: 126 })); await f.settle();
  for (let i = 0; i < 20; i++) { await f.more(); await f.settle(); }
  assert.equal(f.ids().length, 126);
  await f.visible([120, 121, 122]); assert.deepEqual(f.subscriptions.at(-1), [120, 121, 122]);
  const before = f.calls.length; await f.tick(30_001);
  assert.ok(f.calls.length - before <= 2); assert.ok(f.calls.length - before > 0);
  assert.ok(f.subscriptions.every(ids => ids.length <= 24));
});

for (const ids of [[1, 2, 3, 4, 5, 6], []]) {
  test(`a ${ids.length ? 'fully duplicate' : 'empty'} offset page can continue without another scroll event`, async t => {
    const f = fixture(t, options => options.page === 2 ? pageData(2, { ids }) : pageData(options.page));
    await f.settle(); await f.more(); await f.settle(); assert.equal(f.ids().length, 6);
    const button = f.find('Button', f.list().ListFooterComponent);
    assert.equal(button.props.label, 'Load more machines');
    await button.props.onPress(); await f.settle();
    assert.deepEqual(f.calls.map(call => call.page), [1, 2, 3]); assert.deepEqual(f.ids(), [1, 2, 3, 4, 5, 6, 13]);
  });
}

test('a fresh live patch survives appending more cards', async t => {
  const f = fixture(t); await f.settle();
  f.event({ machine_id: 1, received_at: Math.floor(Date.now() / 1000) + 1, machine_status: 'IDLE', alarm: true });
  await f.tick(500); await f.more(); await f.settle();
  const machine = f.list().data.find(machine => machine.machine_id === 1);
  assert.equal(machine.status, 'IDLE'); assert.equal(machine.alarm, true);
});

test('a visible-page refresh that reports zero filtered machines clears every cached page', async t => {
  const f = fixture(t); await f.settle(); await f.more(); await f.settle();
  await f.visible([7, 8]); f.respond(options => pageData(options.page, { total: 0 }));
  await f.tick(30_001); assert.deepEqual(f.ids(), []); assert.deepEqual(f.subscriptions.at(-1), []);
  const calls = f.calls.length; await f.more(); assert.equal(f.calls.length, calls);
});

test('unwatched cached cards are not marked offline solely because they were offscreen', async t => {
  const f = fixture(t, options => pageData(options.page, { received: 1_800_000_000 })); await f.settle(); await f.more(); await f.settle();
  await f.visible([7, 8]); f.respond(() => new Promise(() => {}));
  await f.tick(61_000);
  assert.equal(f.list().data.find(machine => machine.machine_id === 1).status, 'RUNNING');
  assert.equal(f.list().data.find(machine => machine.machine_id === 7).status, 'OFFLINE');
});
