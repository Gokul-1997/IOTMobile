const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const flush = async () => { for (let i = 0; i < 32; i++) await Promise.resolve(); };
function load(file, resolve = () => { throw Error('Unexpected dependency'); }) {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React }
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(resolve, module, module.exports);
  return module.exports;
}
const { LatestRequest, combineSignals } = load('src/api/latestRequest.ts');

test('concurrent reads reuse one request; a superseded reply never applies', async () => {
  const gate = new LatestRequest(); let calls = 0, oldReply;
  const first = gate.run(() => { calls++; return new Promise(resolve => { oldReply = resolve; }); });
  const second = gate.run(() => { calls++; return Promise.resolve('duplicate'); });
  assert.equal(first, second); await flush(); assert.equal(calls, 1);
  const current = gate.run(() => Promise.resolve('current'), 'replace');
  oldReply('old'); assert.equal(await first, undefined); assert.equal(await current, 'current');
});

test('navigation cancellation aborts the actual HTTP signal and suppresses late errors', async () => {
  const gate = new LatestRequest(); let signal, fail;
  const pending = gate.run(s => { signal = s; return new Promise((_, reject) => { fail = reject; }); });
  await flush(); gate.cancel(); assert.equal(signal.aborted, true);
  fail(Error('old network failure')); assert.equal(await pending, undefined);
});

test('a screen signal and sign-out signal each cancel the same HTTP read', () => {
  for (const which of [0, 1]) {
    const screen = new AbortController(), session = new AbortController();
    const combined = combineSignals(screen.signal, session.signal);
    [screen, session][which].abort(); assert.equal(combined.signal.aborted, true); combined.cleanup();
  }
});

// A small hook host executes the real screen's effects with fixture APIs. No native renderer,
// device, network, credentials, or live backend is used by these request-count checks.
function hooks() {
  const values = [], effects = [], queued = []; let cursor = 0;
  const same = (a, b) => !!a && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const react = {
    createElement: () => null,
    useState: initial => { const i = cursor++; if (!(i in values)) values[i] = initial; return [values[i], value => { values[i] = typeof value === 'function' ? value(values[i]) : value; }]; },
    useRef: initial => { const i = cursor++; return values[i] ||= { current: initial }; },
    useCallback: (fn, deps) => { const i = cursor++; if (!same(values[i]?.deps, deps)) values[i] = { deps, fn }; return values[i].fn; },
    useEffect: (fn, deps) => { const i = cursor++; if (!same(effects[i]?.deps, deps)) queued.push(() => { effects[i]?.cleanup?.(); effects[i] = { deps, cleanup: fn() }; }); }
  };
  return { react, render: fn => { cursor = 0; fn(); queued.splice(0).forEach(fn => fn()); }, state: i => values[i], close: () => effects.forEach(effect => effect?.cleanup?.()) };
}
function screenFixture(apis = {}) {
  const host = hooks(), counts = { detail: 0, chart: 0, timeline: 0 };
  let active = true, machineId = 7;
  const detail = (id) => ({ machine: { name: `CNC-${id}` }, shift: { id: 1 } });
  const { MachineDetailScreen } = load('src/screens/machine/MachineDetailScreen.tsx', name => {
    if (name === 'react') return host.react;
    if (name === 'react-native') return { View: () => {}, Text: () => {}, ScrollView: () => {}, RefreshControl: () => {} };
    if (name === '../../api/latestRequest') return { LatestRequest };
    if (name === '../../api/machineDetail') return {
      getMachineDetail: (id, signal) => { counts.detail++; return apis.detail?.(id, signal) ?? Promise.resolve(detail(id)); },
      getMachineTimeline: (id, signal) => { counts.timeline++; return apis.timeline?.(id, signal) ?? Promise.resolve({}); }
    };
    if (name === '../../api/chart') return { getHourlyProduction: (id, shift, date, signal) => { counts.chart++; return apis.chart?.(id, signal) ?? Promise.resolve({ hourlyCount: [] }); } };
    if (name === '../../hooks/useAppActive') return { useAppActive: () => active };
    if (name === '@react-navigation/native') return { useIsFocused: () => active };
    if (name === 'react-native-safe-area-context') return { useSafeAreaInsets: () => ({ bottom: 0 }) };
    if (name === '../../store/authStore') return { useAuthStore: () => ({ id: 1 }) };
    if (name === '../../auth/permissions') return { hasPermission: () => true, SCREEN_PERMISSION: {} };
    if (name === '../../theme/colors') return { statusKey: () => 'IDLE' };
    if (name === '../../theme/ThemeProvider') return { useTheme: () => ({ spacing: {}, colors: {}, radius: {}, type: {}, weight: {} }) };
    if (name.startsWith('../../components/') || name === '@expo/vector-icons/Ionicons') return new Proxy({}, { get: () => () => {} });
    throw Error('Unexpected import: ' + name);
  });
  const render = () => host.render(() => MachineDetailScreen({ route: { params: { machineId, machineName: 'Fixture' } } }));
  return { counts, host, render, blur: () => { active = false; render(); }, machine: id => { machineId = id; render(); }, close: host.close };
}

test('one minute of real detail-screen timers uses 6 recurring reads rather than 9', async t => {
  t.mock.timers.enable({ apis: ['setInterval', 'Date'], now: 1_700_000_000_000 });
  const screen = screenFixture(); screen.render(); await flush();
  assert.deepEqual(screen.counts, { detail: 1, chart: 1, timeline: 1 });
  for (let i = 0; i < 4; i++) { t.mock.timers.tick(15_000); await flush(); }
  assert.deepEqual(screen.counts, { detail: 5, chart: 2, timeline: 2 });
  screen.close();
});

test('slow detail requests do not overlap and blur aborts them', async t => {
  t.mock.timers.enable({ apis: ['setInterval', 'Date'], now: 1_700_000_000_000 });
  let reply, signal;
  const screen = screenFixture({ detail: (_, s) => { signal = s; return new Promise(resolve => { reply = resolve; }); } });
  screen.render(); await flush(); t.mock.timers.tick(30_000); await flush();
  assert.equal(screen.counts.detail, 1);
  screen.blur(); assert.equal(signal.aborted, true);
  reply({ machine: { name: 'Old machine' } }); await flush();
  assert.equal(screen.host.state(0), null); screen.close();
});

test('a delayed old machine response cannot replace the new machine', async () => {
  let oldReply;
  const screen = screenFixture({ detail: id => id === 7
    ? new Promise(resolve => { oldReply = resolve; })
    : Promise.resolve({ machine: { name: 'CNC-8' }, shift: { id: 1 } }) });
  screen.render(); await flush(); screen.machine(8); await flush();
  oldReply({ machine: { name: 'CNC-7' } }); await flush();
  assert.equal(screen.host.state(0).machine.name, 'CNC-8'); screen.close();
});
