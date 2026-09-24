import React from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../theme/ThemeProvider';
import { StmMexaLogo } from '../components/StmMexaLogo';

/* The moment between the splash and the first screen, while the saved
   sign-in is read: the splash's own brand ground, so there is no flash. */
export function BootstrapScreen() {
  const theme = useTheme();
  const [from, to] = theme.colors.headerGradient;
  return (
    <LinearGradient colors={[from, to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 }}>
      <StatusBar style="light" />
      <StmMexaLogo width={200} mono />
      <View accessible accessibilityLabel="Loading" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <ActivityIndicator color="#ffffff" />
        <Text style={{ color: theme.colors.onHeaderMuted, fontSize: 12, fontWeight: '700', letterSpacing: 1.5 }}>LOADING</Text>
      </View>
    </LinearGradient>
  );
}
