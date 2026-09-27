import React from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { StmScreen } from '../components/StmScreen';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../theme/ThemeProvider';
import { StmMexaLogo } from '../components/StmMexaLogo';

/* The moment between the splash and the first screen, while the saved
   sign-in is read: the STM field every screen stands on. */
export function BootstrapScreen() {
  const theme = useTheme();
  return (
    <StmScreen style={{ alignItems: 'center', justifyContent: 'center', gap: 20 }}>
      <StatusBar style="light" />
      <StmMexaLogo width={200} mono />
      <View accessible accessibilityLabel="Loading" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <ActivityIndicator color="#ffffff" />
        <Text style={{ color: theme.colors.onHeaderMuted, fontSize: 12, fontWeight: '700', letterSpacing: 1.5 }}>LOADING</Text>
      </View>
    </StmScreen>
  );
}
