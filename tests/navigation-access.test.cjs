const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(file, resolve = name => { throw Error('Unexpected import: ' + name); }) {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(resolve, module, module.exports);
  return module.exports;
}

const access = load('src/auth/permissions.ts');
const companyAdmin = {
  id: 7, company_id: 4, plant_id: 8, is_snt_super: false,
  roles: ['COMPANY_ADMIN'], permissions: [], company_permissions: ['page:assistant:view'],
};
const enabled = { name: 'Mexa AI', enabled: true, allowance: { limit: 20, remaining: 20 } };

test('AI access requires a company grant and the user role, and excludes S&T accounts', () => {
  const cases = [
    ['company admin explicitly granted AI', companyAdmin, true],
    ['legacy ADMIN explicitly granted AI', { ...companyAdmin, roles: ['ADMIN'] }, true],
    ['no signed-in person', null, false],
    ['company with no grants', { ...companyAdmin, company_permissions: [] }, false],
    ['company missing the AI grant', { ...companyAdmin, company_permissions: ['page:dashboard:view'] }, false],
    ['malformed company grants', { ...companyAdmin, company_permissions: 'page:assistant:view' }, false],
    ['role explicitly granted AI', { ...companyAdmin, roles: ['SUPERVISOR'], permissions: ['page:assistant:view'] }, true],
    ['role missing the AI grant', { ...companyAdmin, roles: ['SUPERVISOR'], permissions: ['page:dashboard:view'] }, false],
    ['role grant without company grant', { ...companyAdmin, roles: ['SUPERVISOR'], permissions: ['page:assistant:view'], company_permissions: [] }, false],
    ['no company assignment', { ...companyAdmin, company_id: null }, false],
    ['S&T flag', { ...companyAdmin, is_snt_super: true }, false],
    ['S&T role', { ...companyAdmin, roles: ['SNT_SUPER'] }, false],
  ];
  for (const [label, user, expected] of cases) {
    assert.equal(access.mayUseAssistant(user), expected, label);
  }
});

test('AI opt-in does not change ordinary page access for a fresh company', () => {
  const user = { ...companyAdmin, company_permissions: [] };
  assert.equal(access.hasPermission(user, 'page:dashboard'), true);
  assert.equal(access.hasPermission(user, 'page:alarms:view'), true);
  assert.equal(access.hasPermission(user, 'page:assistant'), false);
  assert.equal(access.hasPermission(user, 'page:assistant:view'), false);
  assert.equal(access.SCREEN_PERMISSION.assistant, 'page:assistant:view');
});

// Execute the real navigator functions with a tiny JSX host. Screens are not
// rendered and effects do not run: this tests the route registration itself,
// without a native renderer, network, credentials, or source-text assertions.
function navigatorFixture() {
  const state = { user: companyAdmin, status: 'signedIn', authorizationVersion: 0, active: true };
  const assistant = { status: enabled, statusLoading: false, unavailable: false,
    fetchStatus: async () => {}, reset() {}, revoke() {} };
  const effects = [];
  const react = {
    Fragment: Symbol('Fragment'),
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useEffect: fn => { effects.push(fn); }, useState: initial => [initial, () => {}],
    useRef: initial => ({ current: initial }), useCallback: fn => fn, useMemo: fn => fn(),
  };
  const theme = { colors: { field: ['#fff', '#fff', '#fff', '#fff'] }, font: { medium: 'Ubuntu-Medium', bold: 'Ubuntu-Bold' }, spacing: {}, reduceMotion: false };
  const authStore = selector => selector(state);
  authStore.getState = () => state;
  const assistantStore = selector => selector ? selector(assistant) : assistant;
  assistantStore.getState = () => assistant;
  const Tab = { Navigator: Symbol('Tab.Navigator'), Screen: Symbol('Tab.Screen') };
  const Stack = { Navigator: Symbol('Stack.Navigator'), Screen: Symbol('Stack.Screen') };
  const AppBar = () => {};
  let MainTabs;
  const resolve = name => {
    if (name === 'react') return react;
    if (name === '@react-navigation/bottom-tabs') return { createBottomTabNavigator: () => Tab };
    if (name === '@react-navigation/native-stack') return { createNativeStackNavigator: () => Stack };
    if (name === '@react-navigation/native') return { useIsFocused: () => true, useNavigation: () => ({}),
      NavigationContainer: Symbol('NavigationContainer'), DefaultTheme: { colors: {} }, DarkTheme: { colors: {} } };
    if (name === 'react-native-safe-area-context') return { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) };
    if (name === '@expo/vector-icons/Ionicons') return () => {};
    if (name === '../hooks/useAppActive') return { useAppActive: () => state.active };
    if (name === '../theme/ThemeProvider') return { useTheme: () => theme };
    if (name === '../store/authStore') return { useAuthStore: authStore };
    if (name === '../store/assistantStore') return { useAssistantStore: assistantStore };
    if (name === '../auth/permissions') return access;
    if (name === '../components/AppBar') return { AppBar };
    if (name === '../api/notifications') return { getUnreadCount: async () => 0 };
    if (name === '../api/alarms') return { getAlarms: async () => ({ pagination: { total: 0 } }) };
    if (name === '../api/socket') return { onUnreadCount: () => () => {}, connectSocketQuietly: async () => true };
    if (name.startsWith('../screens/')) return { [name.split('/').at(-1)]: () => {} };
    if (name === './MainTabs') return { MainTabs };
    throw Error('Unexpected import: ' + name);
  };
  ({ MainTabs } = load('src/navigation/MainTabs.tsx', resolve));
  const { RootNavigator } = load('src/navigation/RootNavigator.tsx', resolve);
  function routes(tree, type) {
    if (!tree || typeof tree !== 'object') return [];
    return [...(tree.type === type ? [tree] : []), ...[tree.props?.children].flat(Infinity).flatMap(child => routes(child, type))];
  }
  return { state, assistant, tabs: () => MainTabs(), root: () => RootNavigator(),
    runEffects: () => effects.splice(0).map(fn => fn()).filter(Boolean),
    tabRoutes: () => routes(MainTabs(), Tab.Screen), stackRoutes: () => routes(RootNavigator(), Stack.Screen) };
}

for (const [label, status, visible] of [
  ['status is not loaded', null, false],
  ['S&T switched it off', { name: 'Mexa AI', enabled: false, reason: 'SWITCHED_OFF' }, false],
  ['the server is not configured', { name: 'Mexa AI', enabled: false, reason: 'NOT_CONFIGURED' }, false],
  ['company access was removed', { name: 'Mexa AI', enabled: false, reason: 'ACCESS_REMOVED' }, false],
  ['the feature is enabled', enabled, true],
  ['today\'s allowance is exhausted', { ...enabled, allowance: { limit: 20, remaining: 0 } }, true],
]) {
  test(`AI tab registration when ${label}`, () => {
    const fixture = navigatorFixture();
    fixture.assistant.status = status;
    fixture.assistant.statusLoading = status === null;
    const names = fixture.tabRoutes().map(route => route.props.name);
    assert.equal(names.includes('Assistant'), visible);
    assert.equal(names.includes('Profile'), false);
    assert.ok(names.includes('Dashboard'));
    assert.ok(names.includes('Notifications'));
  });
}

test('an enabled cached status cannot bypass revoked company or role access', () => {
  const fixture = navigatorFixture();
  assert.ok(fixture.tabRoutes().some(route => route.props.name === 'Assistant'));
  fixture.state.user = { ...companyAdmin, company_permissions: [] };
  assert.equal(fixture.tabRoutes().some(route => route.props.name === 'Assistant'), false);
  fixture.state.user = { ...companyAdmin, roles: ['SUPERVISOR'], permissions: [] };
  assert.equal(fixture.tabRoutes().some(route => route.props.name === 'Assistant'), false);
  fixture.state.user = { ...companyAdmin, roles: ['SNT_SUPER'] };
  assert.equal(fixture.tabRoutes().some(route => route.props.name === 'Assistant'), false);
});

test('active mobile AI status is rechecked once a minute and its timer stops on cleanup', t => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const fixture = navigatorFixture();
  let checks = 0;
  fixture.assistant.fetchStatus = async () => { checks++; };
  fixture.tabs();
  const cleanup = fixture.runEffects();
  assert.equal(checks, 1);
  t.mock.timers.tick(60_000);
  assert.equal(checks, 2);
  cleanup.forEach(stop => stop());
  t.mock.timers.tick(60_000);
  assert.equal(checks, 2);
});

test('background or ungranted mobile sessions do not poll the AI status', t => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  for (const blocked of ['background', 'ungranted']) {
    const fixture = navigatorFixture();
    let checks = 0, revoked = 0;
    fixture.assistant.fetchStatus = async () => { checks++; };
    fixture.assistant.revoke = () => { revoked++; };
    if (blocked === 'background') fixture.state.active = false;
    else fixture.state.user = { ...companyAdmin, company_permissions: [] };
    fixture.tabs();
    const cleanup = fixture.runEffects();
    t.mock.timers.tick(120_000);
    assert.equal(checks, 0, blocked);
    assert.equal(revoked, blocked === 'ungranted' ? 1 : 0);
    cleanup.forEach(stop => stop());
  }
});

test('the top-right avatar opens the root Profile screen instead of a bottom tab', () => {
  const fixture = navigatorFixture();
  assert.ok(fixture.stackRoutes().some(route => route.props.name === 'Profile'));
  const calls = [];
  const navigation = { getParent: () => ({ navigate: (...args) => calls.push(args) }) };
  const options = fixture.tabs().props.screenOptions({ route: { name: 'Dashboard' }, navigation });
  options.header().props.onProfile();
  assert.deepEqual(calls, [['Profile']]);
});

test('Profile has a back action and Machine Detail opens that same root profile', () => {
  const fixture = navigatorFixture();
  const profile = fixture.stackRoutes().find(route => route.props.name === 'Profile');
  const detail = fixture.stackRoutes().find(route => route.props.name === 'MachineDetail');
  let back = 0;
  const destinations = [];
  const navigation = { goBack: () => { back++; }, navigate: (...args) => destinations.push(args) };
  const profileOptions = typeof profile.props.options === 'function' ? profile.props.options({ navigation }) : profile.props.options;
  const header = profileOptions.header();
  assert.equal(header.props.profileActive, true);
  header.props.onBack();
  assert.equal(back, 1);
  detail.props.options({ navigation }).header().props.onProfile();
  assert.deepEqual(destinations, [['Profile']]);
});

test('signed-out navigation registers only authentication screens', () => {
  const fixture = navigatorFixture();
  fixture.state.status = 'signedOut';
  const names = fixture.stackRoutes().map(route => route.props.name);
  assert.deepEqual(names, ['Login', 'ForgotPassword']);
});
