import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, LayoutChangeEvent } from 'react-native';
import Svg, { Rect, Defs, Pattern, Line } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';
import { MachineTimeline, TimelineState } from '../types/timeline';

const WORD: Record<TimelineState, string> = { RUNNING: 'Running', IDLE: 'Idle', ALARM: 'Alarm', OFF: 'Off' };
const IST = 330 * 60 * 1000;
const clock = (ms: number) => {
  const d = new Date(ms + IST);
  const h = d.getUTCHours(), m = d.getUTCMinutes();
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
};
export const duration = (ms: number) => {
  const n = Math.max(0, Math.round((ms || 0) / 1000));
  const h = Math.floor(n / 3600), m = Math.floor((n % 3600) / 60);
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
};

/*
 * The current shift as one bar — Running / Idle / Alarm / Off, the web
 * machine page's timeline, in the same colours. Breaks are hatched; the
 * rest of the shift is left blank. Tap anywhere on the bar for the period
 * under your finger: its length, its times, and the break it falls in.
 */
export function ShiftTimeline({ data }: { data: MachineTimeline }) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const COLOR: Record<TimelineState, string> = { RUNNING: theme.colors.running, IDLE: theme.colors.idle, ALARM: theme.colors.alarm, OFF: theme.colors.offline };
  const s = data.shift!;
  const span = s.end - s.start || 1;
  const x = (ms: number) => Math.max(0, Math.min(1, (ms - s.start) / span)) * width;
  const H = 30;

  const ticks = useMemo(() => {
    const hours = Math.round(span / 3_600_000), step = hours > 8 ? 3 : 2, out = [];
    for (let h = 0; h <= hours; h += step) out.push(s.start + h * 3_600_000);
    return out;
  }, [s.start, span]);

  const at = picked === null ? null : s.start + (picked / (width || 1)) * span;
  const seg = at === null ? null : data.segments.find(g => at >= g.from && at < g.to) ?? null;
  const brk = at === null ? null : data.breaks.find(b => at >= b.from && at < b.to) ?? null;

  return (
    <View>
      <Pressable
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        onPress={e => setPicked(e.nativeEvent.locationX)}
        accessibilityRole="button"
        accessibilityLabel={`Shift timeline. ${(['RUNNING', 'IDLE', 'ALARM', 'OFF'] as TimelineState[]).map(k => `${WORD[k]} ${duration(data.totals?.[k] ?? 0)}`).join(', ')}. Tap for a period's times.`}
        style={{ height: H, borderRadius: 8, overflow: 'hidden', backgroundColor: theme.colors.surfaceAlt }}>
        {width > 0 && (
          <Svg width={width} height={H}>
            <Defs>
              <Pattern id="hatch" patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(45)">
                <Line x1="0" y1="0" x2="0" y2="7" stroke="rgba(255,255,255,0.7)" strokeWidth="3" />
              </Pattern>
            </Defs>
            {data.segments.map((g, i) => (
              <Rect key={i} x={x(g.from)} y={0} width={Math.max(0.6, x(g.to) - x(g.from))} height={H} fill={COLOR[g.state]} />
            ))}
            {data.breaks.map((b, i) => (
              <Rect key={`b${i}`} x={x(b.from)} y={0} width={x(b.to) - x(b.from)} height={H} fill="url(#hatch)" />
            ))}
            {data.now < s.end && <Rect x={x(data.now) - 1} y={0} width={2} height={H} fill={theme.colors.textPrimary} />}
            {picked !== null && <Rect x={picked - 1} y={0} width={2} height={H} fill="#ffffff" />}
          </Svg>
        )}
      </Pressable>

      <View style={{ height: 16, marginTop: 4 }}>
        {width > 0 && ticks.map((t, i) => (
          <Text key={i} style={{ position: 'absolute', left: Math.min(Math.max(x(t) - 22, 0), width - 44), width: 44, textAlign: i === 0 ? 'left' : i === ticks.length - 1 ? 'right' : 'center',
            fontSize: 10, fontWeight: theme.weight.bold as any, color: theme.colors.textMuted }}>{clock(t).replace(':00', '')}</Text>
        ))}
      </View>

      {(seg || brk) && (
        <View accessibilityLiveRegion="polite" style={{ marginTop: 8, padding: 10, borderRadius: 10, backgroundColor: theme.colors.surfaceAlt, gap: 2 }}>
          {seg && (
            <Text style={{ fontSize: 14, color: theme.colors.textPrimary }}>
              <Text style={{ fontWeight: theme.weight.heavy as any }}>{duration(seg.to - seg.from)} </Text>
              <Text style={{ fontWeight: theme.weight.bold as any, color: COLOR[seg.state] }}>{WORD[seg.state]}</Text>
              <Text style={{ color: theme.colors.textSecondary }}>  {clock(seg.from)} – {clock(seg.to)}</Text>
            </Text>
          )}
          {brk && (
            <Text style={{ fontSize: 12, fontWeight: theme.weight.semibold as any, color: theme.colors.textSecondary }}>
              {seg ? 'During ' : 'Planned: '}{brk.name} ({clock(brk.from)} – {clock(brk.to)})
            </Text>
          )}
        </View>
      )}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 }}>
        {(['RUNNING', 'IDLE', 'ALARM', 'OFF'] as TimelineState[]).map(k => (
          <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: COLOR[k] }} />
            <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>{WORD[k]}</Text>
            <Text style={{ fontSize: 12, fontWeight: theme.weight.bold as any, color: theme.colors.textPrimary, fontVariant: ['tabular-nums'] }}>
              {duration(data.totals?.[k] ?? 0)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
