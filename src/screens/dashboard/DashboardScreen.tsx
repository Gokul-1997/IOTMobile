import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, FlatList, RefreshControl, TextInput } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/ThemeProvider';
import { statusKey, StatusKey } from '../../theme/colors';
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
 *  - a machine that stops reporting turns Offline after a minute even with
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
  const [page, setPage] = useState(1);
  const requestRef = useRef<AbortController | null>(null);
  const visibleIds = useRef(new Set<number>());
  useEffect(() => { const timer = setTimeout(() => { setSearch(query.trim()); setPage(1); }, 300); return () => clearTimeout(timer); }, [query]);

  const pendingUpdates = useRef(new Map<number, { status: MachineStatus; alarm: boolean }>());
  const lastSeenRef = useRef<Map<number, number>>(new Map());      // telemetry freshness, s
  const lastSocketRef = useRef<Map<number, number>>(new Map());    // when the socket last spoke, ms

  const fetchSilently = useCallback(async () => {
    if (!active || !canSee) return;
    requestRef.current?.abort();
    const request = new AbortController();
    requestRef.current = request;
    try {
      const data = await dashboardApi.getDashboard({ page, status: filter.toLowerCase(), search, signal: request.signal });
      if (request.signal.aborted) return;
      if (data.pagination && page > data.pagination.total_pages) { setPage(data.pagination.total_pages); return; }
      visibleIds.current = new Set(data.machines.map(m => m.machine_id));
      setMachineIds([...visibleIds.current]);
      for (const map of [lastSeenRef.current, lastSocketRef.current]) {
        for (const id of map.keys()) if (!visibleIds.current.has(id)) map.delete(id);
      }
      const socketNewer = new Set<number>();
      for (const m of data.machines) {
        const received = telemetrySeconds(m.received_at);
        const latest = lastSeenRef.current.get(m.machine_id) ?? 0;
        const socketLive = Date.now() - (lastSocketRef.current.get(m.machine_id) ?? 0) < SOCKET_SILENT_MS;
        if (socketLive && (received == null || latest > received)) socketNewer.add(m.machine_id);
        else {
          // Keep server telemetry time, never the phone's snapshot-fetch time.
          if (received != null) lastSeenRef.current.set(m.machine_id, Math.max(latest, received));
          else if (m.status !== 'OFFLINE') lastSeenRef.current.set(m.machine_id, Math.floor(Date.now() / 1000));
          pendingUpdates.current.delete(m.machine_id);
        }
      }

      setDashboard((prev) => {
        if (!prev) return data;
        const existing = new Map(prev.machines.map((m) => [m.machine_id, m]));
        const machines = data.machines.map((incoming) => {
          const old = existing.get(incoming.machine_id);
          if (!old) return incoming;
          const live = pendingUpdates.current.get(incoming.machine_id) ?? old;
          return socketNewer.has(incoming.machine_id) ? { ...incoming, status: live.status, alarm: live.alarm } : incoming;
        });
        return { ...data, machines };
      });
      setError(null);
      setLastUpdated(new Date());
    } catch (e: any) {
      if (request.signal.aborted || e?.code === 'ERR_CANCELED') return;
      const status = e?.response?.status;
      setError(status === 403 ? 'forbidden' : 'Cannot reach the server. Showing the last data received.');
    } finally {
      if (requestRef.current === request && !request.signal.aborted) setLoading(false);
    }
  }, [active, canSee, page, filter, search, user?.id]);

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
    setDashboard(prev => {
      if (!prev) return prev;
      let changed = false;
      const machines = prev.machines.map(machine => {
        const patch = updates.get(machine.machine_id);
        if (!patch || (machine.status === patch.status && machine.alarm === patch.alarm)) return machine;
        changed = true;
        return { ...machine, ...patch };
      });
      return changed ? { ...prev, machines } : prev;
    });
  }, []);

  const sweepStaleness = useCallback(() => {
    const nowSec = Math.floor(Date.now() / 1000);
    setNow(Date.now());
    setDashboard((prev) => {
      if (!prev) return prev;
      let changed = false;
      const machines = prev.machines.map((m) => {
        const seenAt = lastSeenRef.current.get(m.machine_id);
        if (seenAt != null && nowSec - seenAt > OFFLINE_THRESHOLD_SEC && m.status !== 'OFFLINE') {
          changed = true;
          return { ...m, status: 'OFFLINE' as MachineStatus };
        }
        return m;
      });
      return changed ? { ...prev, machines } : prev;
    });
  }, []);

  useEffect(() => {
    if (!canSee) { setLoading(false); return; }
    if (!active) return;
    setLoading(true);
    void fetchSilently();
    const batch = setInterval(flushUpdates, 500);
    const poll = setInterval(fetchSilently, POLL_INTERVAL_MS);
    const sweep = setInterval(sweepStaleness, STALENESS_SWEEP_MS);
    return () => { requestRef.current?.abort(); clearInterval(batch); pendingUpdates.current.clear(); clearInterval(poll); clearInterval(sweep); };
  }, [active, canSee, fetchSilently, sweepStaleness, flushUpdates]);

  // Company admins may have no plant; the server authenticates company scope.
  useEffect(() => {
    if (!canSee || !active) return;
    const stop = onMachineUpdate(applySocketUpdate);
    const stopConnected = onSocketConnected(() => { void fetchSilently(); });
    void connectSocketQuietly();
    setMachineIds([...visibleIds.current]);
    return () => { stop(); stopConnected(); setMachineIds([]); };
  }, [canSee, active, user?.id, applySocketUpdate, fetchSilently]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchSilently();
    setRefreshing(false);
  }, [fetchSilently]);

  const machines = dashboard?.machines ?? [];
  const counts = {
    RUNNING: dashboard?.summary.running ?? 0,
    IDLE: dashboard?.summary.idle ?? 0,
    ALARM: dashboard?.summary.alarm ?? 0,
    OFFLINE: dashboard?.summary.offline ?? 0,
  };
  const total = dashboard?.summary.total ?? 0;
  const shown = machines;
  const pages = dashboard?.pagination?.total_pages ?? 1;

  const eyebrow = [user?.company_name, dashboard?.shift?.shift_code].filter(Boolean).join(' · ') || 'Live';

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
      <FlatList
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
                onChange={(k) => { setFilter(k as Filter); setPage(1); }}
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
                  autoCapitalize="none" autoCorrect={false} returnKeyType="search"
                  style={{ flex: 1, color: theme.colors.textPrimary, fontSize: 15, paddingVertical: 10 }} />
                {query ? <Ionicons name="close-circle" size={18} color={theme.colors.textMuted} onPress={() => setQuery('')} accessibilityLabel="Clear search" /> : null}
              </View>
              {error && error !== 'forbidden' && dashboard ? (
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
        ListFooterComponent={pages > 1 ? (
          <View style={{ padding: theme.spacing.lg, gap: 12 }}>
            <Text accessibilityLiveRegion="polite" style={{ color: theme.colors.textSecondary }}>Page {page} of {pages}</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Button label="Previous" variant="secondary" disabled={page <= 1 || loading} onPress={() => setPage(p => p - 1)} />
              <Button label="Next" variant="secondary" disabled={page >= pages || loading} onPress={() => setPage(p => p + 1)} />
            </View>
          </View>
        ) : null}
        ListEmptyComponent={loading ? null : error === 'forbidden'
          ? <NoAccess what="the shop floor" />
          : !dashboard && error
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
