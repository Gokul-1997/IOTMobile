import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { statusKey, statusColors } from '../theme/colors';
import { StatusPill } from './StatusPill';
import { DashboardMachine } from '../types/dashboard';

/* A thin bar with its value printed beside it: the bar only reinforces. */
export function Meter({ value, color, height = 6 }: { value: number; color: string; height?: number }) {
  const theme = useTheme();
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <View style={{ height, borderRadius: 99, backgroundColor: theme.colors.surfaceAlt, overflow: 'hidden' }}>
      <View style={{ width: `${pct}%`, height: '100%', borderRadius: 99, backgroundColor: color }} />
    </View>
  );
}

/*
 * One machine on the floor list. The state is the first thing read: a
 * coloured top edge and a worded pill (an alarm outranks Running / Idle, as
 * on the web list). Then who and what, utilisation, and run / idle time.
 */
export function MachineCard({ m, onPress }: { m: DashboardMachine; onPress?: () => void }) {
  const theme = useTheme();
  const key = statusKey(m.status, m.alarm);
  const c = statusColors(theme.colors, key);
  const util = Math.max(0, Math.min(100, Number(m.utilization) || 0));
  const target = Number(m.target_qty) || 0;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${m.machine_serial_no}, ${c.label}${m.alarm && m.status !== 'OFFLINE' ? `, ${m.status.toLowerCase()} in alarm` : ''}, utilisation ${util.toFixed(0)} percent`}
      accessibilityHint={onPress ? 'Opens the machine' : undefined}
      style={({ pressed }) => ({
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.lg,
        borderWidth: key === 'ALARM' ? 1.5 : 0,
        borderColor: theme.colors.alarm,
        opacity: pressed ? 0.9 : 1,
        ...theme.shadow.card,
      })}
    >
      {/* clipping lives on an inner layer: on iOS a view that clips draws no shadow */}
      <View style={{ borderRadius: theme.radius.lg, overflow: 'hidden' }}>
      <View style={{ height: 4, backgroundColor: c.dot }} />
      <View style={{ padding: theme.spacing.lg, gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <Text numberOfLines={1} style={{ flex: 1, fontSize: theme.type.bodyLarge, fontWeight: theme.weight.heavy as any, color: theme.colors.textPrimary }}>
            {m.machine_serial_no}
          </Text>
          <StatusPill status={key} size="sm" />
          {onPress ? <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} /> : null}
        </View>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Info icon="person-outline" text={m.operator_name && m.operator_name !== '--' ? m.operator_name : 'No operator'} />
          <Info icon="cube-outline" text={m.part_name || 'No active job'} />
        </View>

        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 12, color: theme.colors.textMuted, fontWeight: theme.weight.semibold as any }}>Utilisation</Text>
            <Text style={{ fontSize: 13, color: theme.colors.textPrimary, fontWeight: theme.weight.bold as any, fontVariant: ['tabular-nums'] }}>
              {util.toFixed(1)}%
            </Text>
          </View>
          <Meter value={util} color={theme.colors.accent} />
        </View>

        {/* wraps rather than running together on a narrow phone or with larger text */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', columnGap: 12, rowGap: 6 }}>
          <Time label="Run" value={m.run_time} color={theme.colors.running} />
          <Time label="Idle" value={m.idle_time} color={theme.colors.idle} />
          <Text maxFontSizeMultiplier={theme.textScale.figure} style={{ fontSize: 12, color: theme.colors.textSecondary, fontVariant: ['tabular-nums'] }}>
            <Text style={{ fontWeight: theme.weight.bold as any, color: theme.colors.textPrimary }}>{m.achieved_qty ?? 0}</Text>
            {target ? ` / ${target}` : ''} pcs
          </Text>
        </View>
      </View>
    </View>
    </Pressable>
  );

  function Info({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
    return (
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <Ionicons name={icon} size={14} color={theme.colors.textMuted} />
        <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, color: theme.colors.textSecondary }}>{text}</Text>
      </View>
    );
  }
  function Time({ label, value, color }: { label: string; value: string; color: string }) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: color }} />
        <Text maxFontSizeMultiplier={theme.textScale.figure} style={{ fontSize: 12, color: theme.colors.textMuted }}>{label}</Text>
        <Text maxFontSizeMultiplier={theme.textScale.figure} style={{ fontSize: 13, fontWeight: theme.weight.bold as any, color: theme.colors.textPrimary, fontVariant: ['tabular-nums'] }}>{value || '00:00:00'}</Text>
      </View>
    );
  }
}
