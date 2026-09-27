import React, { useEffect, useRef } from 'react';
import { Animated, Platform, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

// the web build has no native animation driver
const NATIVE = Platform.OS !== 'web';

export function Skeleton({ width, height, radius, style }: { width: number | `${number}%`; height: number; radius?: number; style?: ViewStyle }) {
  const theme = useTheme();
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 650, useNativeDriver: NATIVE }),
        Animated.timing(opacity, { toValue: 0.4, duration: 650, useNativeDriver: NATIVE }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

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
