import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeProvider';
import { statusKey } from '../../theme/colors';
import { useAuthStore } from '../../store/authStore';
import { hasPermission, SCREEN_PERMISSION } from '../../auth/permissions';
import { BrandHeader } from '../../components/BrandHeader';
import { Card, PanelLabel } from '../../components/Card';
import { StatusPill } from '../../components/StatusPill';
import { Meter } from '../../components/MachineCard';
import { NeedleGauge } from '../../components/NeedleGauge';
import { ShiftTimeline } from '../../components/ShiftTimeline';
import { Skeleton } from '../../components/Skeleton';
import { EmptyState, NoAccess } from '../../components/EmptyState';
import { HourlyProductionChart } from '../../components/HourlyProductionChart';
import * as machineDetailApi from '../../api/machineDetail';
import * as chartApi from '../../api/chart';
import { MachineDetailResponse } from '../../types/machineDetail';
import { MachineTimeline } from '../../types/timeline';
import { HourlyProductionPoint } from '../../types/chart';
import { RootStackParamList } from '../../navigation/types';
import { StmScreen } from '../../components/StmScreen';
import { useAppActive } from '../../hooks/useAppActive';
import { useIsFocused } from '@react-navigation/native';

type Props = NativeStackScreenProps<RootStackParamList, 'MachineDetail'>;

const DETAIL_REFRESH_MS = 15_000;
const TIMELINE_REFRESH_MS = 60_000;
const FEED_SCALE = 6000;

function todayIST(): string {
  return new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
}

const sinceIST = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + 330 * 60000);
  const h = d.getUTCHours(), m = d.getUTCMinutes();
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
};

/*
 * One machine, as an instrument panel: its state and any alarm first, then
 * the live dials, the shift so far, and the figures behind OEE. The web
 * machine page's content, laid out for a phone.
 */
export function MachineDetailScreen({ route }: Props) {
  const theme = useTheme();
  const active = useAppActive();
  const focused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { machineId, machineName } = route.params;
  const user = useAuthStore((s) => s.user);
  const allowed = hasPermission(user, SCREEN_PERMISSION.machine);

  const [detail, setDetail] = useState<MachineDetailResponse | null>(null);
  const [timeline, setTimeline] = useState<MachineTimeline | null>(null);
  const [chartData, setChartData] = useState<HourlyProductionPoint[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await machineDetailApi.getMachineDetail(machineId);
      setDetail(data);
      setError(null);
      if (data.shift?.id != null) {
        chartApi.getHourlyProduction(machineId, data.shift.id, todayIST())
          .then((c) => setChartData(c.hourlyCount)).catch(() => setChartData(null));
      }
    } catch (e: any) {
      setError(e?.response?.status === 403 ? 'forbidden' : 'Cannot load this machine. Pull down to try again.');
    }
  }, [machineId]);

  const loadTimeline = useCallback(async () => {
    try { setTimeline(await machineDetailApi.getMachineTimeline(machineId)); } catch { /* the rest of the page stands without it */ }
  }, [machineId]);

  useEffect(() => {
    if (!allowed) { setLoading(false); return; }
    if (!active || !focused) return;
    (async () => { await Promise.all([load(), loadTimeline()]); setLoading(false); })();
    const a = setInterval(load, DETAIL_REFRESH_MS);
    const b = setInterval(loadTimeline, TIMELINE_REFRESH_MS);
    return () => { clearInterval(a); clearInterval(b); };
  }, [allowed, active, focused, load, loadTimeline]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([load(), loadTimeline()]);
    setRefreshing(false);
  }, [load, loadTimeline]);

  const live = detail?.live;
  const key = statusKey(live?.machine_status, live?.alarm);
  const inAlarm = !!live?.alarm;
  const eyebrow = [detail?.shift?.shift_code, detail?.operator?.operator_name].filter((x) => x && x !== '--').join(' · ') || 'Machine';

  const header = (
    // the back button is in the app bar (RootNavigator)
    <BrandHeader title={detail?.machine?.name || machineName} eyebrow={eyebrow}
      right={detail ? <StatusPill status={key} onHeader /> : undefined}>
      {detail && (
        <View style={{ flexDirection: 'row', gap: theme.spacing.xl, marginTop: theme.spacing.md }}>
          <HeaderFact label="Mode" value={live?.mode || '--'} />
          <HeaderFact label="Part" value={detail.job?.part_name || 'No active job'} fill />
          <HeaderFact label="Parts" value={String(live?.parts_count ?? 0)} />
        </View>
      )}
    </BrandHeader>
  );

  if (!allowed) return <StmScreen>{header}<NoAccess what="machine details" /></StmScreen>;

  return (
    <StmScreen>
      {/* no tab bar on this screen: the last card clears the home indicator / Android's navigation bar itself */}
      <ScrollView contentContainerStyle={{ paddingBottom: theme.spacing.xxl + insets.bottom }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.onField} />}>
        {header}

        {loading ? (
          <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
            {[110, 200, 90, 160].map((h, i) => <Skeleton key={i} width="100%" height={h} radius={theme.radius.lg} />)}
          </View>
        ) : !detail ? (
          error === 'forbidden'
            ? <NoAccess what="machine details" />
            : <EmptyState icon="cloud-offline-outline" tone="danger" title="Machine not loaded" message={error ?? undefined} actionLabel="Try again" onAction={onRefresh} />
        ) : (
          <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>

            {/* the alarm first: which one, since when, and why the status reads Idle */}
            {inAlarm && (
              <View accessibilityRole="alert" style={{ borderRadius: theme.radius.lg, borderWidth: 1.5, borderColor: theme.colors.alarm,
                backgroundColor: theme.colors.alarmBg, padding: theme.spacing.lg, gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="warning" size={20} color={theme.colors.alarm} />
                  <Text style={{ fontSize: 16, fontWeight: theme.weight.heavy as any, color: theme.colors.alarmInk }}>This machine is in alarm</Text>
                </View>
                {(live?.active_alarms ?? []).length ? (live!.active_alarms!).map((a, i) => (
                  <Text key={i} style={{ fontSize: 14, color: theme.colors.alarmInk, lineHeight: 20 }}>
                    <Text style={{ fontWeight: theme.weight.heavy as any }}>{a.alarm_code || 'Alarm'} </Text>
                    {a.message || a.alarm_type}
                    <Text style={{ fontWeight: theme.weight.semibold as any }}>  · since {sinceIST(a.started_at)}</Text>
                  </Text>
                )) : (
                  <Text style={{ fontSize: 14, color: theme.colors.alarmInk }}>The controller reports an alarm; its code has not been recorded yet.</Text>
                )}
                {live?.machine_status === 'IDLE' && (
                  <Text style={{ fontSize: 12, color: theme.colors.alarmInk, opacity: 0.9 }}>Status reads Idle because a machine in alarm stops cutting.</Text>
                )}
              </View>
            )}

            {/* live dials */}
            <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
              <Card style={{ flex: 1, paddingHorizontal: 8 }} title="Spindle load">
                <NeedleGauge
                  compact value={Number(live?.spindle_load ?? 0)} min={0} max={150} majorStep={50} minorPerMajor={5}
                  zones={[{ from: 80, to: 100, color: theme.colors.idle }, { from: 100, to: 150, color: theme.colors.alarm }]}
                  tickLabel={(v) => `${v}%`} valueText={(v) => (v === null ? '--' : `${Math.round(v)}%`)}
                  accessibilityLabel={`Spindle load ${Math.round(Number(live?.spindle_load ?? 0))} percent`} />
                <SpindleWord load={Number(live?.spindle_load ?? 0)} />
              </Card>
              <Card style={{ flex: 1, paddingHorizontal: 8 }} title="Feed rate">
                <NeedleGauge
                  compact value={Number(live?.feed_rate ?? 0)} min={0} max={FEED_SCALE} majorStep={2000} minorPerMajor={4}
                  fill={theme.colors.accent} tickLabel={(v) => (v ? `${v / 1000}k` : '0')}
                  valueText={(v) => (v === null ? '--' : `${Math.round(v).toLocaleString('en-IN')}`)}
                  accessibilityLabel={`Feed rate ${Math.round(Number(live?.feed_rate ?? 0))} millimetres per minute`} />
                <Text style={{ textAlign: 'center', fontSize: 12, fontWeight: theme.weight.bold as any, color: theme.colors.textSecondary }}>
                  {Number(live?.feed_rate ?? 0) > FEED_SCALE ? 'Above scale · mm/min' : 'mm/min'}
                </Text>
              </Card>
            </View>

            {/* the shift so far */}
            {timeline?.shift && (
              <Card title={`Shift timeline · ${timeline.shift.code}`}>
                <ShiftTimeline data={timeline} />
              </Card>
            )}

            {/* OEE */}
            <Card title="Overall equipment effectiveness">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.lg }}>
                <View style={{ alignItems: 'center', minWidth: 92 }}>
                  <Text style={{ fontSize: theme.type.display, fontWeight: theme.weight.heavy as any, color: theme.colors.accent, fontVariant: ['tabular-nums'] }}>
                    {Number(detail.oee?.oee ?? 0).toFixed(1)}
                    <Text style={{ fontSize: 16, color: theme.colors.textMuted }}>%</Text>
                  </Text>
                  <Text style={{ fontSize: 11, color: theme.colors.textMuted, fontWeight: theme.weight.bold as any, letterSpacing: 0.8 }}>OEE</Text>
                </View>
                <View style={{ flex: 1, gap: 10 }}>
                  <Factor label="Availability" value={detail.oee?.availability} color={theme.colors.running} />
                  <Factor label="Performance" value={detail.oee?.performance} color={theme.colors.accent} />
                  <Factor label="Quality" value={detail.oee?.quality} color={theme.isDark ? '#c4a8f0' : '#7c5cc4'} />
                </View>
              </View>
            </Card>

            {/* production */}
            <Card title="Production">
              <View style={{ flexDirection: 'row' }}>
                <Figure label="Run time" value={detail.production?.run_time || '00:00:00'} dot={theme.colors.running} />
                <Figure label="Idle time" value={detail.production?.idle_time || '00:00:00'} dot={theme.colors.idle} />
              </View>
              <View style={{ marginTop: theme.spacing.lg, gap: 6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 12, color: theme.colors.textMuted, fontWeight: theme.weight.semibold as any }}>Achieved / target</Text>
                  <Text style={{ fontSize: 13, color: theme.colors.textPrimary, fontWeight: theme.weight.bold as any, fontVariant: ['tabular-nums'] }}>
                    {detail.job?.achieved_qty ?? 0} / {detail.job?.target_qty || '--'} pcs
                  </Text>
                </View>
                <Meter value={detail.job?.target_qty ? (100 * (detail.job.achieved_qty || 0)) / detail.job.target_qty : 0} color={theme.colors.accent} />
              </View>
            </Card>

            {chartData && chartData.length > 0 && (
              <Card title="Parts by hour">
                <HourlyProductionChart data={chartData} />
              </Card>
            )}

            <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
              {/* half a phone wide each: the figures stack, label beside value */}
              <Card style={{ flex: 1 }} title="Quality">
                <Stat label="Accepted" value={String(detail.quality?.accepted ?? 0)} dot={theme.colors.running} />
                <Stat label="Rejected" value={String(detail.quality?.rejected ?? 0)} dot={theme.colors.alarm} last />
              </Card>
              <Card style={{ flex: 1 }} title="Energy · kWh">
                <Stat label="This shift" value={Number(detail.power?.shift_kwh ?? 0).toFixed(1)} />
                <Stat label="Total" value={detail.power?.total_kwh != null ? Number(detail.power.total_kwh).toFixed(0) : '--'} last />
              </Card>
            </View>

            <Card title="Operator and job">
              <Row icon="person-outline" label="Operator" value={detail.operator?.operator_name || '--'} />
              <Row icon="id-card-outline" label="Employee ID" value={detail.operator?.employee_id || '--'} />
              <Row icon="cube-outline" label="Part" value={detail.job?.part_name || '--'} />
              <Row icon="barcode-outline" label="Component" value={String(detail.job?.component_id ?? '--')} last />
            </Card>
          </View>
        )}
      </ScrollView>
    </StmScreen>
  );

  // the part name takes the room that is left; mode and count keep their width
  function HeaderFact({ label, value, fill }: { label: string; value: string; fill?: boolean }) {
    return (
      <View style={fill ? { flex: 1, minWidth: 0 } : { flexShrink: 0, maxWidth: 120 }}>
        <Text numberOfLines={1} maxFontSizeMultiplier={theme.textScale.figure}
          style={{ color: theme.colors.onHeaderMuted, fontSize: 10, fontWeight: theme.weight.bold as any, letterSpacing: 1, textTransform: 'uppercase' }}>{label}</Text>
        <Text numberOfLines={1} maxFontSizeMultiplier={theme.textScale.figure}
          style={{ color: theme.colors.onHeader, fontSize: 15, fontWeight: theme.weight.bold as any, marginTop: 2 }}>{value}</Text>
      </View>
    );
  }
  function Factor({ label, value, color }: { label: string; value: number | undefined; color: string }) {
    const v = Number(value ?? 0);
    return (
      <View style={{ gap: 4 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 12, color: theme.colors.textSecondary, fontWeight: theme.weight.semibold as any }}>{label}</Text>
          <Text style={{ fontSize: 13, color: theme.colors.textPrimary, fontWeight: theme.weight.bold as any, fontVariant: ['tabular-nums'] }}>{v.toFixed(1)}%</Text>
        </View>
        <Meter value={v} color={color} />
      </View>
    );
  }
  function Figure({ label, value, dot, unit }: { label: string; value: string; dot?: string; unit?: string }) {
    return (
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {dot ? <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: dot }} /> : null}
          <PanelLabel>{label}</PanelLabel>
        </View>
        <Text style={{ fontSize: 20, fontWeight: theme.weight.heavy as any, color: theme.colors.textPrimary, fontVariant: ['tabular-nums'] }}>
          {value}{unit ? <Text style={{ fontSize: 12, color: theme.colors.textMuted }}> {unit}</Text> : null}
        </Text>
      </View>
    );
  }
  function Stat({ label, value, dot, last }: { label: string; value: string; dot?: string; last?: boolean }) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6,
        borderBottomWidth: last ? 0 : 1, borderBottomColor: theme.colors.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {dot ? <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: dot }} /> : null}
          <Text style={{ fontSize: 13, color: theme.colors.textSecondary }}>{label}</Text>
        </View>
        <Text style={{ fontSize: 18, fontWeight: theme.weight.heavy as any, color: theme.colors.textPrimary, fontVariant: ['tabular-nums'] }}>{value}</Text>
      </View>
    );
  }
  function Row({ icon, label, value, last }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; last?: boolean }) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10,
        borderBottomWidth: last ? 0 : 1, borderBottomColor: theme.colors.border }}>
        <Ionicons name={icon} size={18} color={theme.colors.textMuted} />
        <Text style={{ fontSize: 14, color: theme.colors.textSecondary, width: 104 }}>{label}</Text>
        <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, fontWeight: theme.weight.bold as any, color: theme.colors.textPrimary, textAlign: 'right' }}>{value}</Text>
      </View>
    );
  }
  function SpindleWord({ load }: { load: number }) {
    const w = load > 100 ? ['Overload', theme.colors.alarmInk] : load >= 80 ? ['High', theme.colors.idleInk] : ['Normal', theme.colors.runningInk];
    return <Text style={{ textAlign: 'center', fontSize: 12, fontWeight: theme.weight.heavy as any, color: w[1] }}>{w[0]}</Text>;
  }
}
