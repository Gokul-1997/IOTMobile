import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, RefreshControl, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeProvider';
import { useAuthStore } from '../../store/authStore';
import { hasPermission, SCREEN_PERMISSION } from '../../auth/permissions';
import { BrandHeader } from '../../components/BrandHeader';
import { StatusFilter } from '../../components/StatusFilter';
import { Button } from '../../components/Button';
import { EmptyState, NoAccess } from '../../components/EmptyState';
import { Skeleton } from '../../components/Skeleton';
import * as alarmsApi from '../../api/alarms';
import { MachineAlarm } from '../../types/alarm';

const PAGE_LIMIT = 20;
type View_ = 'active' | 'open' | 'resolved';

const IST = 330 * 60000;
function when(iso: string) {
  const d = new Date(new Date(iso).getTime() + IST);
  const today = new Date(Date.now() + IST).toISOString().slice(0, 10);
  const h = d.getUTCHours(), m = d.getUTCMinutes();
  const t = `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
  const day = d.toISOString().slice(0, 10);
  return day === today ? t : `${d.getUTCDate()} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getUTCMonth()]}, ${t}`;
}
function lasted(fromIso: string, toIso: string | null) {
  const ms = (toIso ? new Date(toIso).getTime() : Date.now()) - new Date(fromIso).getTime();
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

/*
 * Alarms from the controllers.
 *  - Active now: the controller has not cleared it — what is wrong on the
 *    floor this minute;
 *  - Unresolved: nobody has marked it dealt with yet, cleared or not;
 *  - Resolved: marked dealt with, by whom and when.
 * Severity is the controller's: Critical or Normal. (This screen used to
 * expect Low / Medium / High, so every alarm read "Low".) Resolve is offered
 * only to a role that may resolve — the API refuses anyone else.
 */
export function AlarmsScreen() {
  const theme = useTheme();
  const user = useAuthStore((s) => s.user);
  const canSee = hasPermission(user, SCREEN_PERMISSION.alarms);
  const canResolve = hasPermission(user, SCREEN_PERMISSION.resolveAlarm);

  const [view, setView] = useState<View_>('active');
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [items, setItems] = useState<MachineAlarm[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [resolvingId, setResolvingId] = useState<number | null>(null);

  const params = useCallback((p: number): alarmsApi.GetAlarmsParams => ({
    page: p, limit: PAGE_LIMIT,
    ...(view === 'active' ? { active: true, is_resolved: false } : { is_resolved: view === 'resolved' }),
    ...(criticalOnly ? { severity: 'CRITICAL' as const } : {}),
  }), [view, criticalOnly]);

  const load = useCallback(async (p = 1) => {
    try {
      const res = await alarmsApi.getAlarms(params(p));
      setItems((prev) => (p === 1 ? res.data : [...prev, ...res.data]));
      setTotal(res.pagination.total);
      setPage(res.pagination.page);
      setPages(res.pagination.totalPages || 1);
      setError(null);
    } catch (e: any) {
      setError(e?.response?.status === 403 ? 'forbidden' : 'Cannot load alarms. Pull down to try again.');
    }
  }, [params]);

  useEffect(() => {
    if (!canSee) { setLoading(false); return; }
    setLoading(true);
    load(1).finally(() => setLoading(false));
  }, [canSee, load]);

  const onRefresh = useCallback(async () => { setRefreshing(true); await load(1); setRefreshing(false); }, [load]);
  const loadMore = useCallback(async () => {
    if (more || page >= pages) return;
    setMore(true); await load(page + 1); setMore(false);
  }, [more, page, pages, load]);

  const resolve = useCallback(async (id: number) => {
    setResolvingId(id);
    try {
      await alarmsApi.resolveAlarm(id);
      setConfirmId(null);
      await load(1);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Could not resolve this alarm. Try again.');
    } finally {
      setResolvingId(null);
    }
  }, [load]);

  const header = <BrandHeader title="Alarms" eyebrow={canSee && !loading ? `${total} ${view === 'active' ? 'active now' : view === 'open' ? 'unresolved' : 'resolved'}` : 'Machine alarms'} />;
  if (!canSee) return <View style={{ flex: 1, backgroundColor: theme.colors.background }}>{header}<NoAccess what="alarms" /></View>;

  const renderItem = ({ item }: { item: MachineAlarm }) => {
    const critical = String(item.severity).toUpperCase() === 'CRITICAL';
    const activeNow = !item.ended_at;
    const tint = critical ? theme.colors.alarm : theme.colors.idle;
    return (
      <View accessible={confirmId !== item.id}
        accessibilityLabel={`${item.machine_serial_no}, ${critical ? 'critical' : 'normal'} alarm ${item.alarm_code ?? ''} ${item.message ?? item.alarm_type}, ${activeNow ? 'active' : 'cleared'}${item.is_resolved ? ', resolved' : ''}`}
        style={{ backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, borderWidth: 1,
          borderColor: activeNow && critical ? theme.colors.alarm : theme.colors.border, overflow: 'hidden', ...theme.shadow.card }}>
        <View style={{ flexDirection: 'row' }}>
          <View style={{ width: 4, backgroundColor: tint }} />
          <View style={{ flex: 1, padding: theme.spacing.lg, gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text numberOfLines={1} style={{ flex: 1, fontSize: 16, fontWeight: theme.weight.heavy as any, color: theme.colors.textPrimary }}>{item.machine_serial_no}</Text>
              <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, backgroundColor: critical ? theme.colors.alarmBg : theme.colors.idleBg }}>
                <Text style={{ fontSize: 11, fontWeight: theme.weight.heavy as any, letterSpacing: 0.6, color: critical ? theme.colors.alarmInk : theme.colors.idleInk }}>
                  {critical ? 'CRITICAL' : 'NORMAL'}
                </Text>
              </View>
            </View>
            <Text style={{ fontSize: 15, color: theme.colors.textPrimary, lineHeight: 21 }}>
              {item.alarm_code ? <Text style={{ fontWeight: theme.weight.heavy as any }}>{item.alarm_code}  </Text> : null}
              {item.message || item.alarm_type}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: activeNow ? theme.colors.alarm : theme.colors.offline }} />
              <Text style={{ fontSize: 13, color: theme.colors.textSecondary }}>
                {activeNow ? `Active · since ${when(item.started_at)} (${lasted(item.started_at, null)})`
                           : `Cleared · ${when(item.started_at)}, lasted ${lasted(item.started_at, item.ended_at)}`}
              </Text>
            </View>
            {item.is_resolved && (
              <Text style={{ fontSize: 13, color: theme.colors.success, fontWeight: theme.weight.semibold as any }}>
                Resolved{item.resolved_by_name ? ` by ${item.resolved_by_name}` : ''}{item.resolved_at ? ` · ${when(item.resolved_at)}` : ''}
              </Text>
            )}
            {!item.is_resolved && canResolve && (
              confirmId === item.id ? (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                  <Button compact label="Confirm resolve" icon="checkmark-done" onPress={() => resolve(item.id)} loading={resolvingId === item.id} style={{ flex: 1 }} />
                  <Button compact variant="ghost" label="Cancel" onPress={() => setConfirmId(null)} />
                </View>
              ) : (
                <Button compact variant="secondary" label="Resolve" icon="checkmark" onPress={() => setConfirmId(item.id)}
                  accessibilityLabel={`Resolve alarm on ${item.machine_serial_no}`} style={{ alignSelf: 'flex-start', marginTop: 4 }} />
              )
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <FlatList
        data={loading ? [] : items}
        keyExtractor={(a) => String(a.id)}
        renderItem={(info) => <View style={{ paddingHorizontal: theme.spacing.lg }}>{renderItem(info)}</View>}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        contentContainerStyle={{ paddingBottom: theme.spacing.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.accent} />}
        ItemSeparatorComponent={() => <View style={{ height: theme.spacing.md }} />}
        ListHeaderComponent={
          <View style={{ marginBottom: theme.spacing.md }}>
            {header}
            <View style={{ paddingTop: theme.spacing.lg, gap: 10 }}>
              <StatusFilter accessibilityLabel="Which alarms" value={view} onChange={(k) => setView(k as View_)}
                chips={[{ key: 'active', label: 'Active now', dot: theme.colors.alarm }, { key: 'open', label: 'Unresolved' }, { key: 'resolved', label: 'Resolved' }]} />
              <Pressable onPress={() => setCriticalOnly((v) => !v)} accessibilityRole="switch" accessibilityState={{ checked: criticalOnly }}
                style={{ marginHorizontal: theme.spacing.lg, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 36, alignSelf: 'flex-start' }}>
                <Ionicons name={criticalOnly ? 'checkbox' : 'square-outline'} size={20} color={criticalOnly ? theme.colors.alarm : theme.colors.textMuted} />
                <Text style={{ fontSize: 14, fontWeight: theme.weight.bold as any, color: theme.colors.textPrimary }}>Critical only</Text>
              </Pressable>
              {error && error !== 'forbidden' && items.length > 0 ? (
                <Text accessibilityRole="alert" style={{ marginHorizontal: theme.spacing.lg, color: theme.colors.danger, fontWeight: theme.weight.semibold as any }}>{error}</Text>
              ) : null}
              {loading && <View style={{ paddingHorizontal: theme.spacing.lg, gap: theme.spacing.md }}>{[0, 1, 2].map((i) => <Skeleton key={i} width="100%" height={120} radius={theme.radius.lg} />)}</View>}
            </View>
          </View>
        }
        ListFooterComponent={more ? <ActivityIndicator style={{ margin: theme.spacing.lg }} color={theme.colors.accent} /> : null}
        ListEmptyComponent={loading ? null : error === 'forbidden' ? <NoAccess what="alarms" />
          : error ? <EmptyState icon="cloud-offline-outline" tone="danger" title="Alarms not loaded" message={error} actionLabel="Try again" onAction={onRefresh} />
          : <EmptyState icon={view === 'active' ? 'shield-checkmark-outline' : 'checkmark-done-outline'}
              title={view === 'active' ? 'No active alarms' : view === 'open' ? 'Nothing unresolved' : 'No resolved alarms'}
              message={view === 'active' ? (criticalOnly ? 'No critical alarm is active on any machine.' : 'Every machine is clear of alarms right now.') : undefined} />}
      />
    </View>
  );
}
