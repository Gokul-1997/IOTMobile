import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { useAuthStore } from '../store/authStore';
import { BrandLogo } from './StmMexaLogo';

const initialsOf = (name: string) =>
  name.split(/[\s._@-]+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';

/*
 * The bar over every signed-in screen, as on the web app: the STM MEXA mark
 * on the left — after a back button on a screen that was opened from
 * another — and on the right the person's initials, which open Profile.
 * It stays put while the screen scrolls under it, and it starts below the
 * status bar, notch or Dynamic Island by the top inset on every phone.
 */
export function AppBar({ onBack, onProfile, profileActive = false }: {
  onBack?: () => void;
  onProfile?: () => void;
  /** on the Profile screen itself: the initials show as the current place */
  profileActive?: boolean;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const name = user?.username || user?.email || '';

  return (
    <View style={{ backgroundColor: theme.colors.chrome, paddingTop: insets.top,
      paddingLeft: Math.max(insets.left, onBack ? theme.spacing.sm : theme.spacing.lg),
      // the initials' circle ends 16 from the edge, in line with the cards
      paddingRight: Math.max(insets.right, theme.spacing.md),
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.chromeBorder }}>
      {/* dark icons on the white bar, light ones on the dark bar */}
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          {onBack ? (
            <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" hitSlop={6}
              style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
                backgroundColor: pressed ? theme.colors.surfaceAlt : 'transparent' })}>
              <Ionicons name="chevron-back" size={26} color={theme.colors.textPrimary} />
            </Pressable>
          ) : null}
          <BrandLogo width={84} />
        </View>

        <Pressable onPress={onProfile} disabled={!onProfile || profileActive} hitSlop={6}
          accessibilityRole="button" accessibilityLabel={name ? `Profile, ${name}` : 'Profile'}
          accessibilityState={{ selected: profileActive }}
          style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
            borderWidth: 2, borderColor: profileActive ? theme.colors.accent : 'transparent', opacity: pressed ? 0.8 : 1 })}>
          {/* the logo's navy-to-wine, behind white initials (7:1 or better) */}
          <LinearGradient colors={['#2B3990', '#843D67']} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }}
            style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}>
            <Text maxFontSizeMultiplier={theme.textScale.fixed}
              style={{ color: '#ffffff', fontSize: 14, fontWeight: theme.weight.heavy as any, letterSpacing: 0.4 }}>
              {initialsOf(name)}
            </Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}
