import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { StmMexaLogo } from './StmMexaLogo';

/*
 * The brand header every screen opens with, standing on the STM field
 * (StmScreen) with the STM MEXA mark in white. Title and a small eyebrow line
 * (company · shift) on the left; `right` for a live clock or an action;
 * `children` for anything that belongs on the gradient, such as the fleet
 * utilisation dial.
 */
export function BrandHeader({ title, eyebrow, right, onBack, children, showLogo = true }: {
  title: string;
  eyebrow?: string;
  right?: React.ReactNode;
  onBack?: () => void;
  children?: React.ReactNode;
  showLogo?: boolean;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  // no background of its own: the header stands on the screen's STM field
  return (
    <View style={{ paddingTop: insets.top + theme.spacing.sm, paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.lg }}>
      <StatusBar style="light" />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 32 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {onBack ? (
            <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" hitSlop={12}
              style={({ pressed }) => ({ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
                backgroundColor: pressed ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.12)' })}>
              <Ionicons name="chevron-back" size={22} color={theme.colors.onHeader} />
            </Pressable>
          ) : null}
          {showLogo && <StmMexaLogo width={78} mono />}
        </View>
        {right}
      </View>
      <View style={{ marginTop: theme.spacing.md }}>
        {eyebrow ? (
          <Text numberOfLines={1} style={{ color: theme.colors.onHeaderMuted, fontSize: theme.type.micro, fontWeight: theme.weight.bold as any, letterSpacing: 1, textTransform: 'uppercase' }}>
            {eyebrow}
          </Text>
        ) : null}
        <Text accessibilityRole="header" numberOfLines={1}
          style={{ color: theme.colors.onHeader, fontSize: theme.type.title, fontWeight: theme.weight.heavy as any, letterSpacing: -0.3, marginTop: 2 }}>
          {title}
        </Text>
      </View>
      {children}
    </View>
  );
}

/* "LIVE" with a dot, or how long ago the data landed. */
export function LiveTag({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.14)',
      borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: theme.colors.running }} />
      <Text style={{ color: theme.colors.onHeader, fontSize: 11, fontWeight: theme.weight.bold as any, letterSpacing: 0.6 }}>{label}</Text>
    </View>
  );
}
