import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, FlatList, RefreshControl, TextInput, ActivityIndicator } from 'react-native';
import { ThemeText as Text } from '../../components/ThemeText';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/ThemeProvider';
import { StatusKey } from '../../theme/colors';
import { useAuthStore } from '../../store/authStore';
import { hasPermission, SCREEN_PERMISSION } from '../../auth/permissions';
import { BrandHeader, LiveTag } from '../../components/BrandHeader';
import { FleetUtilizationRing } from '../../components/FleetUtilizationRing';
import { StatusFilter } from '../../components/StatusFilter';
import { MachineCard } from '../../components/MachineCard';
import { EmptyState, NoAccess } from '../../components/EmptyState';
import { Skeleton } from '../../components/Skeleton';
import * as dashboardApi from '../../api/dashboard';
import { connectSocketQuietly, setMachineIds, onMachineUpdate, onSocketConnected, MachineUpdatePayload } from '../../api/socket';
import { DashboardMachine, DashboardResponse, MachineStatus } from '../../types/dashboard';
import { StmScreen } from '../../components/StmScreen';
import { Button } from '../../components/Button';
import { useAppActive } from '../../hooks/useAppActive';
import { telemetrySeconds } from '../../api/telemetryTime';

/*
 * The shop floor: every machine, its state first.
 *
 * Data, as on the web Live Dashboard:
 *  - a REST snapshot every 30 s carries the heavier figures (run / idle
 *    time, utilisation, parts, operator, job);
 *  - the socket patches status and alarm the moment telemetry lands;
 *  - a machine the socket has been quiet about for a minute takes its
 *    status and alarm from the snapshot instead — they froze at the first
 *    load before, so a cleared alarm stayed red;
 *  - a visible machine that stops reporting turns Offline after a minute even with
 *    no new event.
 */
const POLL_INTERVAL_MS = 30_000;
const OFFLINE_THRESHOLD_SEC = 60;       // the list's own threshold (dashboard.service.js)
const SOCKET_SILENT_MS = 60_000;
const STALENESS_SWEEP_MS = 5_000;

function resolveStatus(machineStatus: string | undefined, receivedAtSec: number | null): MachineStatus {
  if (!receivedAtSec) return 'OFFLINE';
  if (Math.floor(Date.now() / 1000) - receivedAtSec > OFFLINE_THRESHOLD_SEC) return 'OFFLINE';
  if (['RUN', 'RUNNING', 'CUTTING'].includes((machineStatus || '').toUpperCase())) return 'RUNNING';
  return 'IDLE';
}

function timeAgo(date: Date | null, now: number) {
  if (!date) return 'CONNECTING';
  const sec = Math.floor((now - date.getTime()) / 1000);
  if (sec < 10) return 'LIVE';
  if (sec < 60) return `${sec}s AGO`;
  return `${Math.floor(sec / 60)}m AGO`;
}

type Filter = 'ALL' | StatusKey;

export function DashboardScreen() {
  const theme = useTheme();
  const appActive = useAppActive();
  const focused = useIsFocused();
  const active = appActive && focused;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const user = useAuthStore((s) => s.user);
  const canSee = hasPermission(user, SCREEN_PERMISSION.dashboard);
  const canOpenMachine = hasPermission(user, SCREEN_PERMISSION.machine);

  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [now, setNow] = useState(Date.now());
  const [filter, setFilter] = useState<Filter>('ALL');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);
  const listRef = useRef<FlatList<DashboardMachine>>(null);
  const snapshotRequest = useRef<AbortController | null>(null);
  const appendRequest = useRef<AbortController | null>(null);
  const epoch = useRef(0);
  const pageCache = useRef(new Map<number, { machines: DashboardMachine[]; fetchedAt: number }>());
  const lastPage = useRef(0);
  const totalPages = useRef(1);
  const moreFailed = useRef(false);
  const lastSnapshotAt = useRef(0);
  const visibleIds = useRef(new Set<number>());
  const viewTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingUpdates = useRef(new Map<number, { status: MachineStatus; alarm: boolean }>());
  const lastSeenRef = useRef(new Map<number, number>());
  const lastSocketRef = useRef(new Map<number, number>());
  const scopeKey = JSON.stringify([user?.id, user?.company_id, user?.plant_id, user?.auth_revision, filter, search]);
  const scope = useRef(scopeKey);
  scope.current = scopeKey;
  const dataScope = useRef<string | null>(null);
  const isActive = useRef(active && canSee);
  isActive.current = active && canSee;

  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const cancelRequests = useCallback(() => {
    epoch.current++;
    snapshotRequest.current?.abort(); snapshotRequest.current = null;
    appendRequest.current?.abort(); appendRequest.current = null;
    clearTimeout(viewTimer.current);
    pendingUpdates.current.clear();
  }, []);

  const resetFeed = useCallback((showLoading = true) => {
    cancelRequests();
    pageCache.current.clear();
    lastPage.current = 0; totalPages.current = 1;
    dataScope.current = null;
    moreFailed.current = false;
    lastSnapshotAt.current = 0;
    visibleIds.current.clear();
    lastSeenRef.current.clear(); lastSocketRef.current.clear();
    setMachineIds([]);
    setDashboard(null); setError(null); setMoreError(null);
    setLoading(showLoading); setLoadingMore(false); setRefreshing(false); setLastUpdated(null);
  }, [cancelRequests]);

  // Cache page positions, deduplicate shifting offset pages by machine ID and
  // preserve live patches on already loaded cards when another page arrives.
  const applyPage = useCallback((data: DashboardResponse, page: number) => {
    const sameScope = dataScope.current === scope.current;
    const firstPage = lastPage.current === 0;
    const pages = Math.max(1, data.pagination?.total_pages ?? 1);
    totalPages.current = pages;
    if (data.pagination?.total === 0) pageCache.current.clear();
    for (const key of pageCache.current.keys()) if (key > pages) pageCache.current.delete(key);
    if (page <= pages) pageCache.current.set(page, { machines: data.machines, fetchedAt: Date.now() });
    lastPage.current = Math.min(Math.max(lastPage.current, page), pages);

    const all = new Map<number, DashboardMachine>();
    for (const [, cached] of [...pageCache.current].sort(([a], [b]) => a - b)) {
      for (const machine of cached.machines) if (!all.has(machine.machine_id)) all.set(machine.machine_id, machine);
    }
    const incoming = new Map(data.machines.map(machine => [machine.machine_id, machine]));
    const socketNewer = new Set<number>();
    for (const machine of data.machines) {
      const received = telemetrySeconds(machine.received_at);
      const latest = lastSeenRef.current.get(machine.machine_id) ?? 0;
      const socketLive = Date.now() - (lastSocketRef.current.get(machine.machine_id) ?? 0) < SOCKET_SILENT_MS;
      if (socketLive && (received == null || latest > received)) socketNewer.add(machine.machine_id);
      else {
        if (received != null) lastSeenRef.current.set(machine.machine_id, Math.max(latest, received));
        pendingUpdates.current.delete(machine.machine_id);
      }
    }
    for (const map of [lastSeenRef.current, lastSocketRef.current, pendingUpdates.current]) {
      for (const id of map.keys()) if (!all.has(id)) map.delete(id);
    }
    const ids = [...visibleIds.current].filter(id => all.has(id));
    if (firstPage) ids.push(...data.machines.slice(0, dashboardApi.DASHBOARD_PAGE_SIZE).map(machine => machine.machine_id));
    const nextVisible = [...new Set(ids)].slice(0, 24);
    if (nextVisible.join(',') !== [...visibleIds.current].join(',')) {
      visibleIds.current = new Set(nextVisible);
      if (isActive.current) setMachineIds(nextVisible);
    }
    dataScope.current = scope.current;
    setDashboard(previous => {
      const existing = new Map((sameScope ? previous?.machines ?? [] : []).map(machine => [machine.machine_id, machine]));
      const machines = [...all.values()].map(cached => {
        const fresh = incoming.get(cached.machine_id);
        const old = existing.get(cached.machine_id);
        if (!fresh) return old ?? cached;
        const live = pendingUpdates.current.get(cached.machine_id) ?? old;
        return live && socketNewer.has(cached.machine_id) ? { ...fresh, status: live.status, alarm: live.alarm } : fresh;
      });
      return { ...data, machines, pagination: data.pagination ? { ...data.pagination, page: lastPage.current } : undefined };
    });
    setError(null); setLastUpdated(new Date());
    lastSnapshotAt.current = Date.now();
  }, []);

  // Refresh at most two visible pages, rather than all previously scrolled
  // pages. One snapshot lane and one append lane bound concurrent API work.
  const fetchSilently = useCallback(async (force = false) => {
    if (scopeKey !== scope.current || !isActive.current || snapshotRequest.current || appendRequest.current) return;
    const candidates = [...pageCache.current].filter(([, cached]) => cached.machines.some(machine => visibleIds.current.has(machine.machine_id)));
    const visiblePages = candidates.length ? candidates : [[1, pageCache.current.get(1)] as const];
    const due = visiblePages.filter(([, cached]) => force || Date.now() - (cached?.fetchedAt ?? 0) >= POLL_INTERVAL_MS)
      .sort(([, a], [, b]) => (a?.fetchedAt ?? 0) - (b?.fetchedAt ?? 0)).slice(0, 2).map(([page]) => page);
    if (!due.length) return;
    const request = new AbortController(); snapshotRequest.current = request;
    const revision = epoch.current, requestScope = scope.current;
    const current = () => !request.signal.aborted && snapshotRequest.current === request && revision === epoch.current && requestScope === scope.current && isActive.current;
    try {
      for (const page of due) {
        const data = await dashboardApi.getDashboard({ page, status: filter.toLowerCase(), search, signal: request.signal });
        if (!current()) return;
        applyPage(data, page);
      }
    } catch (e: any) {
      if (!current() || e?.code === 'ERR_CANCELED') return;
      if (e?.response?.status === 403) { resetFeed(false); setError('forbidden'); }
      else setError('Cannot reach the server. Showing the last data received.');
    } finally {
      if (snapshotRequest.current === request) {
        snapshotRequest.current = null;
        if (currentScope(requestScope, revision)) { setLoading(false); setRefreshing(false); }
      }
    }
    function currentScope(key: string, revision: number) {
      return !request.signal.aborted && key === scope.current && revision === epoch.current && isActive.current;
    }
  }, [scopeKey, filter, search, applyPage, resetFeed]);
  const refreshVisible = useRef(fetchSilently);
  refreshVisible.current = fetchSilently;

  const loadMore = useCallback(async (retry = false) => {
    if (scopeKey !== scope.current || !isActive.current || appendRequest.current || lastPage.current === 0 || lastPage.current >= totalPages.current || (moreFailed.current && !retry)) return;
    const request = new AbortController(); appendRequest.current = request;
    const revision = epoch.current, requestScope = scope.current, page = lastPage.current + 1;
    const current = () => !request.signal.aborted && appendRequest.current === request && revision === epoch.current && requestScope === scope.current && isActive.current;
    moreFailed.current = false; setMoreError(null); setLoadingMore(true);
    try {
      const data = await dashboardApi.getDashboard({ page, status: filter.toLowerCase(), search, signal: request.signal });
      if (!current()) return;
      applyPage(data, page);
    } catch (e: any) {
      if (!current() || e?.code === 'ERR_CANCELED') return;
      if (e?.response?.status === 403) { resetFeed(false); setError('forbidden'); }
      else { moreFailed.current = true; setMoreError('Could not load more machines. Please try again.'); }
    } finally {
      if (appendRequest.current === request) {
        appendRequest.current = null;
        if (!request.signal.aborted && revision === epoch.current && requestScope === scope.current && isActive.current) {
          setLoadingMore(false);
          void refreshVisible.current();
        }
      }
    }
  }, [scopeKey, filter, search, applyPage, resetFeed]);

  const applySocketUpdate = useCallback((update: MachineUpdatePayload) => {
    if (!visibleIds.current.has(update.machine_id)) return;
    const receivedAtSec = telemetrySeconds(update.received_at);
    if (receivedAtSec == null || receivedAtSec < (lastSeenRef.current.get(update.machine_id) ?? 0)) return;
    lastSeenRef.current.set(update.machine_id, receivedAtSec);
    lastSocketRef.current.set(update.machine_id, Date.now());
    const status = resolveStatus(update.machine_status, receivedAtSec);
    pendingUpdates.current.set(update.machine_id, { status, alarm: !!update.alarm });
  }, []);

  const flushUpdates = useCallback(() => {
    if (!pendingUpdates.current.size) return;
    const updates = new Map(pendingUpdates.current);
    pendingUpdates.current.clear();
    setDashboard(previous => {
      if (!previous) return previous;
      let changed = false;
      const machines = previous.machines.map(machine => {
        const patch = updates.get(machine.machine_id);
        if (!patch || (machine.status === patch.status && machine.alarm === patch.alarm)) return machine;
        changed = true;
        return { ...machine, ...patch };
      });
      return changed ? { ...previous, machines } : previous;
    });
  }, []);

  const sweepStaleness = useCallback(() => {
    const nowSec = Math.floor(Date.now() / 1000);
    setNow(Date.now());
    setDashboard(previous => {
      if (!previous) return previous;
      let changed = false;
      const machines = previous.machines.map(machine => {
        const seenAt = lastSeenRef.current.get(machine.machine_id);
        if (visibleIds.current.has(machine.machine_id) && seenAt != null && nowSec - seenAt > OFFLINE_THRESHOLD_SEC && machine.status !== 'OFFLINE') {
          changed = true;
          return { ...machine, status: 'OFFLINE' as MachineStatus };
        }
        return machine;
      });
      return changed ? { ...previous, machines } : previous;
    });
  }, []);

  // FlatList requires stable viewability callbacks/configuration. Debouncing
  // subscriptions keeps fast scrolling below the server's request limit.
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 10, minimumViewTime: 150 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: Array<{ item: DashboardMachine; isViewable: boolean }> }) => {
    const ids = [...new Set(viewableItems.filter(item => item.isViewable).map(item => item.item.machine_id))].slice(0, 24);
    clearTimeout(viewTimer.current);
    viewTimer.current = setTimeout(() => {
      if (!isActive.current || dataScope.current !== scope.current) return;
      const loadedIds = new Set([...pageCache.current.values()].flatMap(cached => cached.machines.map(machine => machine.machine_id)));
      const next = ids.filter(id => loadedIds.has(id));
      if (next.join(',') !== [...visibleIds.current].join(',')) {
        visibleIds.current = new Set(next);
        setMachineIds(next);
      }
      void refreshVisible.current();
    }, 200);
  }).current;

  useEffect(() => { resetFeed(canSee); }, [scopeKey, canSee, resetFeed]);

  useEffect(() => {
    if (!canSee || !active) return;
    setLoading(pageCache.current.size === 0); setLoadingMore(false); setRefreshing(false);
    void fetchSilently(true);
    const batch = setInterval(flushUpdates, 500);
    const poll = setInterval(() => { void fetchSilently(); }, POLL_INTERVAL_MS);
    const sweep = setInterval(sweepStaleness, STALENESS_SWEEP_MS);
    return () => {
      cancelRequests(); setMachineIds([]);
      clearInterval(batch); clearInterval(poll); clearInterval(sweep);
    };
  }, [active, canSee, scopeKey, fetchSilently, sweepStaleness, flushUpdates, cancelRequests]);

  useEffect(() => {
    if (!canSee || !active) return;
    const stop = onMachineUpdate(applySocketUpdate);
    const stopConnected = onSocketConnected(() => {
      if (snapshotRequest.current || appendRequest.current || Date.now() - lastSnapshotAt.current < 5_000) return;
      void fetchSilently(true);
    });
    void connectSocketQuietly();
    setMachineIds([...visibleIds.current]);
    return () => { stop(); stopConnected(); setMachineIds([]); };
  }, [canSee, active, scopeKey, applySocketUpdate, fetchSilently]);

  const onRefresh = useCallback(async () => {
    if (scopeKey !== scope.current || !isActive.current) return;
    resetFeed(); setRefreshing(true);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
    await fetchSilently(true);
  }, [scopeKey, resetFeed, fetchSilently]);

  const currentDashboard = dataScope.current === scopeKey ? dashboard : null;
  const shown = currentDashboard?.machines ?? [];
  const counts = {
    RUNNING: currentDashboard?.summary.running ?? 0,
    IDLE: currentDashboard?.summary.idle ?? 0,
    ALARM: currentDashboard?.summary.alarm ?? 0,
    OFFLINE: currentDashboard?.summary.offline ?? 0,
  };
  const total = currentDashboard?.summary.total ?? 0;
  const hasMore = lastPage.current < totalPages.current;

  const eyebrow = [user?.company_name, currentDashboard?.shift?.shift_code].filter(Boolean).join(' · ') || 'Live';

  const header = (
    <BrandHeader title="Shop Floor" eyebrow={eyebrow} right={canSee ? <LiveTag label={timeAgo(lastUpdated, now)} /> : undefined}>
      {canSee && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.lg, marginTop: theme.spacing.lg }}>
          <FleetUtilizationRing value={total ? counts.RUNNING * 100 / total : 0} label="Running" size={116} />
          <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 }}>
            {([['RUNNING', 'Running', theme.colors.running], ['IDLE', 'Idle', theme.colors.idle],
               ['ALARM', 'Alarm', theme.colors.alarm], ['OFFLINE', 'Offline', theme.colors.offline]] as const).map(([k, label, dot]) => (
              <View key={k} style={{ width: '50%' }} accessible accessibilityLabel={`${label} ${counts[k]}`}>
                <Text maxFontSizeMultiplier={theme.textScale.figure} style={{ color: '#fff', fontSize: 26, fontWeight: theme.weight.heavy as any, fontVariant: ['tabular-nums'] }}>{counts[k]}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot }} />
                  <Text numberOfLines={1} maxFontSizeMultiplier={theme.textScale.figure} style={{ flexShrink: 1, color: theme.colors.onHeaderMuted, fontSize: 11, fontWeight: theme.weight.bold as any, letterSpacing: 0.8, textTransform: 'uppercase' }}>{label}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}
    </BrandHeader>
  );

  if (!canSee) {
    return <StmScreen>{header}<NoAccess what="the shop floor" /></StmScreen>;
  }

  return (
    <StmScreen>
      <FlatList<DashboardMachine>
        ref={listRef}
        key={scopeKey}
        onEndReached={() => loadMore()}
        onEndReachedThreshold={0.4}
        initialNumToRender={dashboardApi.DASHBOARD_PAGE_SIZE}
        maxToRenderPerBatch={dashboardApi.DASHBOARD_PAGE_SIZE}
        windowSize={5}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        data={loading ? [] : shown}
        keyExtractor={(m) => String(m.machine_id)}
        contentContainerStyle={{ paddingBottom: theme.spacing.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.onField} />}
        ListHeaderComponent={
          <View>
            {header}
            <View style={{ paddingTop: theme.spacing.lg, gap: theme.spacing.md }}>
              <StatusFilter
                accessibilityLabel="Show machines"
                value={filter}
                onChange={(k) => setFilter(k as Filter)}
                chips={[
                  { key: 'ALL', label: 'All', count: total },
                  { key: 'ALARM', label: 'Alarm', count: counts.ALARM, dot: theme.colors.alarm },
                  { key: 'RUNNING', label: 'Running', count: counts.RUNNING, dot: theme.colors.running },
                  { key: 'IDLE', label: 'Idle', count: counts.IDLE, dot: theme.colors.idle },
                  { key: 'OFFLINE', label: 'Offline', count: counts.OFFLINE, dot: theme.colors.offline },
                ]}
              />
              <View style={{ marginHorizontal: theme.spacing.lg, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44,
                paddingHorizontal: 12, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface }}>
                <Ionicons name="search" size={18} color={theme.colors.textMuted} />
                <TextInput value={query} onChangeText={setQuery} placeholder="Search machine"
                  placeholderTextColor={theme.colors.textMuted} accessibilityLabel="Search machine"
                  autoCapitalize="none" autoCorrect={false} returnKeyType="search" maxLength={100}
                  style={{ flex: 1, color: theme.colors.textPrimary, fontSize: 15, fontFamily: theme.font.regular, paddingVertical: 10 }} />
                {query ? <Ionicons name="close-circle" size={18} color={theme.colors.textMuted} onPress={() => setQuery('')} accessibilityLabel="Clear search" /> : null}
              </View>
              {error && error !== 'forbidden' && currentDashboard ? (
                <View accessibilityRole="alert" style={{ marginHorizontal: theme.spacing.lg, padding: 10, borderRadius: theme.radius.md, backgroundColor: theme.colors.warningBg, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <Ionicons name="cloud-offline-outline" size={18} color={theme.colors.warning} />
                  <Text style={{ flex: 1, color: theme.colors.warning, fontSize: 13, fontWeight: theme.weight.semibold as any }}>{error}</Text>
                </View>
              ) : null}
              {loading && (
                <View style={{ paddingHorizontal: theme.spacing.lg, gap: theme.spacing.md }}>
                  {[0, 1, 2].map((i) => <Skeleton key={i} width="100%" height={170} radius={theme.radius.lg} />)}
                </View>
              )}
            </View>
            <View style={{ height: theme.spacing.md }} />
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: theme.spacing.md }} />}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: theme.spacing.lg }}>
            <MachineCard m={item} onPress={canOpenMachine
              ? () => navigation.navigate('MachineDetail', { machineId: item.machine_id, machineName: item.machine_serial_no })
              : undefined} />
          </View>
        )}
        ListFooterComponent={!loading && shown.length > 0 ? (
          <View style={{ padding: theme.spacing.lg, gap: 12, alignItems: 'center' }}>
            {loadingMore ? <ActivityIndicator accessibilityLabel="Loading more machines" color={theme.colors.onField} />
              : moreError ? <>
                <Text accessibilityRole="alert" style={{ color: theme.colors.onField }}>{moreError}</Text>
                <Button label="Try again" variant="secondary" onPress={() => loadMore(true)} />
              </> : hasMore
                // Also allows keyboard/screen-reader loading and recovery if a
                // shifting offset page contains no new IDs/content height.
                ? <Button label="Load more machines" variant="secondary" onPress={() => loadMore()} />
                : <Text accessibilityLiveRegion="polite" style={{ color: theme.colors.onFieldMuted }}>End of machine list</Text>}
          </View>
        ) : null}
        ListEmptyComponent={loading ? null : error === 'forbidden'
          ? <NoAccess what="the shop floor" />
          : !currentDashboard && error
            ? <EmptyState icon="cloud-offline-outline" tone="danger" title="Cannot reach the server" message={error} actionLabel="Try again" onAction={onRefresh} />
            : <EmptyState icon="hardware-chip-outline"
                title={total ? 'No machines match' : 'No machines yet'}
                message={total ? 'Change the filter or the search.' : 'Machines appear here once they are added and start reporting.'}
                actionLabel={total ? 'Show all' : undefined}
                onAction={total ? () => { setFilter('ALL'); setQuery(''); } : undefined} />}
      />
    </StmScreen>
  );
}
