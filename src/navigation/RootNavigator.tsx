import React from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../theme/ThemeProvider';
import { useAuthStore } from '../store/authStore';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { BootstrapScreen } from '../screens/BootstrapScreen';
import { MachineDetailScreen } from '../screens/machine/MachineDetailScreen';
import { MainTabs } from './MainTabs';
import { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const theme = useTheme();
  const status = useAuthStore((s) => s.status);

  const navTheme = {
    ...(theme.isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(theme.isDark ? DarkTheme.colors : DefaultTheme.colors),
      background: theme.colors.background,
      primary: theme.colors.accent,
      card: theme.colors.surface,
      border: theme.colors.border,
      text: theme.colors.textPrimary,
    },
  };

  if (status === 'checking') {
    return <BootstrapScreen />;
  }

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {status === 'signedIn' ? (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            {/* the machine screen draws its own brand header, with a back button */}
            <Stack.Screen name="MachineDetail" component={MachineDetailScreen} options={{ animation: 'slide_from_right' }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ animation: 'slide_from_right' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
