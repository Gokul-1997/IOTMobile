import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ThemeText as Text } from './ThemeText';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeProvider';

/*
 * The page's own header, under the app bar (AppBar: the logo and the
 * profile) and standing on the STM field: a small eyebrow line (company ·
 * shift), the title, and `right` on the title's line for a live clock, a
 * state or an action; `children` for anything that belongs on the field,
 * such as the fleet utilisation dial.
 */
export function BrandHeader({ title, eyebrow, right, children }: {
  title: string;
  eyebrow?: string;
  right?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={{ paddingTop: theme.spacing.lg, paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, borderRadius: 14, padding: theme.spacing.md, overflow: 'hidden' }}>
        <LinearGradient colors={theme.colors.headerBar} locations={theme.isDark ? [0, 0.6, 1] : [0, 0.55, 1]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
        <View style={{ flex: 1, minWidth: 0 }}>
          {eyebrow ? (
            <Text numberOfLines={1} style={{ color: theme.colors.onHeaderMuted, fontSize: theme.type.micro, fontWeight: theme.weight.bold as any, letterSpacing: 1, textTransform: 'uppercase' }}>
              {eyebrow}
            </Text>
          ) : null}
          <Text accessibilityRole="header" numberOfLines={1}
            style={{ color: theme.colors.onHeader, fontSize: theme.type.subtitle, fontWeight: theme.weight.bold as any, letterSpacing: -0.2, marginTop: 2 }}>
            {title}
          </Text>
        </View>
        {right ? <View style={{ flexShrink: 0 }}>{right}</View> : null}
      </View>
      {children}
    </View>
  );
}

/* "LIVE" with a dot, or how long ago the data landed. */
export function LiveTag({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.colors.fieldChip,
      borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: theme.colors.running }} />
      <Text maxFontSizeMultiplier={theme.textScale.figure} style={{ color: theme.colors.onHeader, fontSize: 11, fontWeight: theme.weight.bold as any, letterSpacing: 0.6 }}>{label}</Text>
    </View>
  );
}
