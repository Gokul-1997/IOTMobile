import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, FlatList, RefreshControl, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
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
import { connectSocketQuietly, joinPlant, onMachineUpdate, offMachineUpdate, MachineUpdatePayload } from '../../api/socket';
import { DashboardMachine, DashboardResponse, MachineStatus } from '../../types/dashboard';
import { StmScreen } from '../../components/StmScreen';

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

  const lastSeenRef = useRef<Map<number, number>>(new Map());      // telemetry freshness, s
  const lastSocketRef = useRef<Map<number, number>>(new Map());    // when the socket last spoke, ms

  const fetchSilently = useCallback(async () => {
    try {
      const data = await dashboardApi.getDashboard();
      const nowSec = Math.floor(Date.now() / 1000);
      for (const m of data.machines) if (m.status !== 'OFFLINE') lastSeenRef.current.set(m.machine_id, nowSec);

      setDashboard((prev) => {
        if (!prev) return data;
        const existing = new Map(prev.machines.map((m) => [m.machine_id, m]));
        const machines = data.machines.map((incoming) => {
          const old = existing.get(incoming.machine_id);
          if (!old) return incoming;
          const socketLive = Date.now() - (lastSocketRef.current.get(incoming.machine_id) ?? 0) < SOCKET_SILENT_MS;
          // the socket owns status and alarm while it is live for this machine
          return socketLive ? { ...incoming, status: old.status, alarm: old.alarm } : incoming;
        });
        return { ...data, machines };
      });
      setError(null);
      setLastUpdated(new Date());
    } catch (e: any) {
      const status = e?.response?.status;
      setError(status === 403 ? 'forbidden' : 'Cannot reach the server. Showing the last data received.');
    }
  }, []);

  const applySocketUpdate = useCallback((update: MachineUpdatePayload) => {
    const receivedAtSec = update.received_at != null
      ? Math.floor(new Date(update.received_at).getTime() / 1000) || Number(update.received_at)
      : Math.floor(Date.now() / 1000);
    lastSeenRef.current.set(update.machine_id, receivedAtSec);
    lastSocketRef.current.set(update.machine_id, Date.now());
    const status = resolveStatus(update.machine_status, receivedAtSec);
    setDashboard((prev) => {
      if (!prev) return prev;
      let changed = false;
      const machines = prev.machines.map((m) => {
        if (m.machine_id !== update.machine_id) return m;
        if (m.status === status && m.alarm === !!update.alarm) return m;
        changed = true;
        return { ...m, status, alarm: !!update.alarm };
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
    (async () => { await fetchSilently(); setLoading(false); })();
    const poll = setInterval(fetchSilently, POLL_INTERVAL_MS);
    const sweep = setInterval(sweepStaleness, STALENESS_SWEEP_MS);
    return () => { clearInterval(poll); clearInterval(sweep); };
  }, [canSee, fetchSilently, sweepStaleness]);

  // live updates on top of the poll; a socket that cannot connect is not an error
  useEffect(() => {
    if (!canSee || !user?.plant_id) return;
    let cancelled = false;
    (async () => {
      const ok = await connectSocketQuietly();
      if (cancelled || !ok) return;
      joinPlant(Number(user.plant_id));
      onMachineUpdate(applySocketUpdate);
    })();
    return () => { cancelled = true; offMachineUpdate(); };
  }, [canSee, user?.plant_id, applySocketUpdate]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchSilently();
    setRefreshing(false);
  }, [fetchSilently]);

  const machines = dashboard?.machines ?? [];
  const counts = useMemo(() => {
    const c = { RUNNING: 0, IDLE: 0, ALARM: 0, OFFLINE: 0 };
    for (const m of machines) c[statusKey(m.status, m.alarm)]++;
    const util = machines.length ? machines.reduce((s, m) => s + (Number(m.utilization) || 0), 0) / machines.length : 0;
    return { ...c, util };
  }, [machines]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return machines
      .filter((m) => filter === 'ALL' || statusKey(m.status, m.alarm) === filter)
      .filter((m) => !q || m.machine_serial_no.toLowerCase().includes(q) || (m.operator_name || '').toLowerCase().includes(q))
      // alarms first, then running, idle, offline; by name within each
      .sort((a, b) => {
        const order: Record<StatusKey, number> = { ALARM: 0, RUNNING: 1, IDLE: 2, OFFLINE: 3 };
        return order[statusKey(a.status, a.alarm)] - order[statusKey(b.status, b.alarm)] || a.machine_serial_no.localeCompare(b.machine_serial_no, undefined, { numeric: true });
      });
  }, [machines, filter, query]);

  const eyebrow = [user?.company_name, dashboard?.shift?.shift_code].filter(Boolean).join(' · ') || 'Live';

  const header = (
    <BrandHeader title="Shop Floor" eyebrow={eyebrow} right={canSee ? <LiveTag label={timeAgo(lastUpdated, now)} /> : undefined}>
      {canSee && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.lg, marginTop: theme.spacing.lg }}>
          <FleetUtilizationRing value={counts.util} size={116} />
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
                onChange={(k) => setFilter(k as Filter)}
                chips={[
                  { key: 'ALL', label: 'All', count: machines.length },
                  { key: 'ALARM', label: 'Alarm', count: counts.ALARM, dot: theme.colors.alarm },
                  { key: 'RUNNING', label: 'Running', count: counts.RUNNING, dot: theme.colors.running },
                  { key: 'IDLE', label: 'Idle', count: counts.IDLE, dot: theme.colors.idle },
                  { key: 'OFFLINE', label: 'Offline', count: counts.OFFLINE, dot: theme.colors.offline },
                ]}
              />
              <View style={{ marginHorizontal: theme.spacing.lg, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44,
                paddingHorizontal: 12, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface }}>
                <Ionicons name="search" size={18} color={theme.colors.textMuted} />
                <TextInput value={query} onChangeText={setQuery} placeholder="Search machine or operator"
                  placeholderTextColor={theme.colors.textMuted} accessibilityLabel="Search machine or operator"
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
        ListEmptyComponent={loading ? null : error === 'forbidden'
          ? <NoAccess what="the shop floor" />
          : !dashboard && error
            ? <EmptyState icon="cloud-offline-outline" tone="danger" title="Cannot reach the server" message={error} actionLabel="Try again" onAction={onRefresh} />
            : <EmptyState icon="hardware-chip-outline"
                title={machines.length ? 'No machines match' : 'No machines yet'}
                message={machines.length ? 'Change the filter or the search.' : 'Machines appear here once they are added and start reporting.'}
                actionLabel={machines.length ? 'Show all' : undefined}
                onAction={machines.length ? () => { setFilter('ALL'); setQuery(''); } : undefined} />}
      />
    </StmScreen>
  );
}
