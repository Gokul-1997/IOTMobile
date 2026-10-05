import React from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../theme/ThemeProvider';
import { BrandLogo } from '../components/StmMexaLogo';

/* The moment between the splash and the first screen, while the saved
   sign-in is read. It carries the splash on — the same ground (app.json:
   white, or #0B0C10 in dark mode) and the original mark at the splash's
   size — so the hand-over does not jump. */
export function BootstrapScreen() {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.isDark ? '#0B0C10' : '#FFFFFF' }}>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      <BrandLogo width={theme.isDark ? 94 : 116} />
      <View accessible accessibilityLabel="Loading"
        style={{ position: 'absolute', bottom: '30%', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <ActivityIndicator color={theme.colors.textMuted} />
        <Text style={{ color: theme.colors.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 1.5 }}>LOADING</Text>
      </View>
    </View>
  );
}
