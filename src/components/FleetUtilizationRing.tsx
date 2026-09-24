import React, { useEffect, useRef } from 'react';
import { View, Text, Animated } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/*
 * Fleet utilisation on the brand bar: a white ring on a faint track, the
 * figure in the middle. Sized by `size`; the ring fills in once on arrival
 * (not on every poll — a dial that re-sweeps every 30 s reads as a fault).
 */
export function FleetUtilizationRing({ value, size = 128, stroke = 11 }: { value: number; size?: number; stroke?: number }) {
  const theme = useTheme();
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;

  const progress = useRef(new Animated.Value(0)).current;
  const animated = useRef(false);
  useEffect(() => {
    if (animated.current) { progress.setValue(pct); return; }
    animated.current = true;
    Animated.timing(progress, { toValue: pct, duration: 800, useNativeDriver: false }).start();
  }, [pct, progress]);

  const offset = progress.interpolate({ inputRange: [0, 100], outputRange: [circ, 0] });

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={`Fleet utilisation ${Math.round(pct)} percent`}
      style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.22)" strokeWidth={stroke} fill="none" />
        <AnimatedCircle cx={size / 2} cy={size / 2} r={r} stroke="#FFFFFF" strokeWidth={stroke} fill="none"
          strokeLinecap="round" strokeDasharray={`${circ}, ${circ}`} strokeDashoffset={offset as any} />
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
