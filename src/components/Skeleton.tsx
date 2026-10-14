import React, { useEffect, useRef } from 'react';
import { Animated, Platform, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { useAppActive } from '../hooks/useAppActive';
import { useIsFocused } from '@react-navigation/native';

// the web build has no native animation driver
const NATIVE = Platform.OS !== 'web';

export function Skeleton({ width, height, radius, style }: { width: number | `${number}%`; height: number; radius?: number; style?: ViewStyle }) {
  const theme = useTheme();
  const active = useAppActive();
  const focused = useIsFocused();
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (theme.reduceMotion || !active || !focused) { opacity.setValue(0.6); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 650, useNativeDriver: NATIVE }),
        Animated.timing(opacity, { toValue: 0.4, duration: 650, useNativeDriver: NATIVE }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, theme.reduceMotion, active, focused]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius ?? theme.radius.sm,
          // placeholders stand on the STM field
          backgroundColor: theme.colors.fieldChip,
          opacity,
        },
        style,
      ]}
    />
  );
}
