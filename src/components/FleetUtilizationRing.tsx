import React, { useEffect, useRef, useState } from 'react';
import { View, Text, AccessibilityInfo } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';

/*
 * Fleet utilisation on the brand header: a white ring on a faint track, the
 * figure in the middle. Sized by `size`; the ring sweeps up once when the
 * first reading arrives (not on every poll — a dial that re-sweeps every
 * 30 s reads as a fault), and not at all for anyone who has asked their
 * phone for less motion.
 *
 * The sweep is a plain state count-up, not Animated: an Animated SVG circle
 * gets `collapsable={false}` from Animated, which the web build passes on
 * to the DOM <circle> and React reports as an error.
 */
const SWEEP_MS = 800;

export function FleetUtilizationRing({ value, size = 128, stroke = 11 }: { value: number; size?: number; stroke?: number }) {
  const theme = useTheme();
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;

  const [shown, setShown] = useState(0);
  const swept = useRef(false);

  useEffect(() => {
    // after the first sweep the ring simply follows the data
    if (swept.current || pct === 0) { setShown(pct); return; }
    swept.current = true;

    let frame: number | undefined;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().catch(() => false).then((reduce) => {
      if (cancelled) return;
      if (reduce) { setShown(pct); return; }
      const start = Date.now();
      const step = () => {
        const t = Math.min(1, (Date.now() - start) / SWEEP_MS);
        setShown(pct * (1 - Math.pow(1 - t, 3)));   // ease-out
        if (t < 1 && !cancelled) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    });
    return () => { cancelled = true; if (frame !== undefined) cancelAnimationFrame(frame); };
  }, [pct]);

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={`Fleet utilisation ${Math.round(pct)} percent`}
      style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.22)" strokeWidth={stroke} fill="none" />
        {shown > 0 && (
          <Circle cx={size / 2} cy={size / 2} r={r} stroke="#FFFFFF" strokeWidth={stroke} fill="none"
            strokeLinecap="round" strokeDasharray={`${circ} ${circ}`} strokeDashoffset={circ * (1 - shown / 100)} />
        )}
      </Svg>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
          <Text style={{ fontSize: size * 0.27, fontWeight: theme.weight.heavy as any, color: '#FFFFFF', lineHeight: size * 0.3 }}>{Math.round(pct)}</Text>
          <Text style={{ fontSize: 15, fontWeight: theme.weight.bold as any, color: 'rgba(255,255,255,0.85)', marginBottom: 4, marginLeft: 1 }}>%</Text>
        </View>
        <Text style={{ fontSize: 10, fontWeight: theme.weight.bold as any, letterSpacing: 1, color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase' }}>
          Utilisation
        </Text>
      </View>
    </View>
  );
}
