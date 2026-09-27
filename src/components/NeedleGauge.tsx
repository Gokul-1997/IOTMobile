import React, { useMemo } from 'react';
import { View, Text, Platform } from 'react-native';
import Svg, { Path, Line, Text as SvgText, Circle, Polygon } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';

export interface GaugeZone { from: number; to: number; color: string }

/*
 * The web app's needle gauge (shared/needle-gauge), in react-native-svg:
 * a thick band with coloured zones and clean gaps, a tick ring, labels
 * outside, a tapered needle on a ringed pivot, the reading underneath. A
 * reading past the scale pins the needle; the number stays true.
 */
export function NeedleGauge({ value, min = 0, max = 100, zones = [], fill, majorStep = 25, minorPerMajor = 5,
  tickLabel = v => String(v), valueText, accessibilityLabel, compact = false }: {
  value: number | null; min?: number; max?: number; zones?: GaugeZone[]; fill?: string;
  majorStep?: number; minorPerMajor?: number; tickLabel?: (v: number) => string;
  valueText: (v: number | null) => string; accessibilityLabel: string;
  /** Half a phone wide: the drawing is scaled down about half, so its type
   *  is set larger to land at a readable size. */
  compact?: boolean;
}) {
  const theme = useTheme();
  // compact: wide enough for "150%" at the right end of the scale
  const W = compact ? 392 : 320, H = compact ? 170 : 160, CX = W / 2, CY = compact ? 150 : 140, R = compact ? 100 : 104, BAND = compact ? 24 : 20, GAP = 0.9 / 180;
  // SVG text does not inherit the app's font on the web preview
  const FONT = Platform.OS === 'web' ? 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' : undefined;
  const LABEL = compact ? 21 : 12;
  const frac = (v: number) => (Math.min(max, Math.max(min, v)) - min) / (max - min || 1);
  const pt = (f: number, r: number) => { const a = Math.PI * (1 - f); return { x: CX + r * Math.cos(a), y: CY - r * Math.sin(a) }; };
  const arc = (a: number, b: number, gap = true) => {
    if (gap) { if (a > 0) a += GAP / 2; if (b < 1) b -= GAP / 2; }
    if (b <= a) return '';
    const p = pt(a, R), q = pt(b, R);
    return `M ${p.x.toFixed(2)} ${p.y.toFixed(2)} A ${R} ${R} 0 0 1 ${q.x.toFixed(2)} ${q.y.toFixed(2)}`;
  };

  const scale = useMemo(() => {
    const pieces: { a: number; b: number; color: string | null }[] = [];
    let at = min;
    for (const z of [...zones].sort((x, y) => x.from - y.from)) {
      if (z.from > at) pieces.push({ a: frac(at), b: frac(z.from), color: null });
      pieces.push({ a: frac(Math.max(z.from, at)), b: frac(z.to), color: z.color });
      at = Math.max(at, z.to);
    }
    if (at < max) pieces.push({ a: frac(at), b: 1, color: null });
    const ticks = [];
    const minor = majorStep / Math.max(1, minorPerMajor), inner = R - BAND / 2 - 5;
    for (let v = min, i = 0; v <= max + 1e-9; v += minor, i++) {
      const major = i % minorPerMajor === 0, f = frac(v);
      const p = pt(f, inner), q = pt(f, inner - (major ? 10 : 5));
      ticks.push({ ...{ x1: p.x, y1: p.y, x2: q.x, y2: q.y }, major });
    }
    const labels = [];
    for (let v = min; v <= max + 1e-9; v += majorStep) {
      const f = frac(v), p = pt(f, R + BAND / 2 + (compact ? 16 : 12));
      labels.push({ x: p.x, y: p.y, text: tickLabel(v), anchor: (f < 0.3 ? 'end' : f > 0.7 ? 'start' : 'middle') as any });
    }
    return { pieces, ticks, labels };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [min, max, zones, majorStep, minorPerMajor]);

  const track = theme.isDark ? '#2a2f3b' : '#e8eaf0';
  const ink = theme.colors.textPrimary;
  const deg = value === null ? -90 : frac(value) * 180 - 90;
  const tip = R - BAND / 2 - 9;
  // the needle, drawn pointing up and turned about the pivot here
  const rad = (deg * Math.PI) / 180, cos = Math.cos(rad), sin = Math.sin(rad);
  const turn = (dx: number, dy: number) => `${(CX + dx * cos - dy * sin).toFixed(2)},${(CY + dx * sin + dy * cos).toFixed(2)}`;
  const needle = [turn(-8, 0), turn(0, -tip), turn(8, 0), turn(0, 14)].join(' ');
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel} style={{ width: '100%' }}>
      <Svg width="100%" style={{ aspectRatio: W / H }} viewBox={`0 0 ${W} ${H}`}>
        {scale.pieces.map((p, i) => (
          <Path key={i} d={arc(p.a, p.b)} stroke={p.color ?? track} strokeWidth={BAND} fill="none" />
        ))}
        {fill && value !== null && value > min ? <Path d={arc(0, frac(value), false)} stroke={fill} strokeWidth={BAND} fill="none" /> : null}
        {scale.ticks.map((t, i) => (
          <Line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke={t.major ? ink : theme.colors.textMuted}
            strokeWidth={t.major ? 2 : 1} strokeLinecap="round" />
        ))}
        {scale.labels.map((l, i) => (
          <SvgText key={i} x={l.x} y={l.y + LABEL * 0.36} fontSize={LABEL} fontWeight="700" fontFamily={FONT} fill={theme.colors.textSecondary} textAnchor={l.anchor}>{l.text}</SvgText>
        ))}
        <Polygon points={needle} fill={ink} />
        <Circle cx={CX} cy={CY} r={10} fill={ink} />
        <Circle cx={CX} cy={CY} r={5} fill={theme.colors.surface} />
      </Svg>
      <Text style={{ textAlign: 'center', fontSize: compact ? 22 : 26, fontWeight: '800', color: ink, fontVariant: ['tabular-nums'], marginTop: 2 }}>
        {valueText(value)}
      </Text>
    </View>
  );
}
