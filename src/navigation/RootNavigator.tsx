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
import { AppBar } from '../components/AppBar';
import { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const theme = useTheme();
  const status = useAuthStore((s) => s.status);

  const navTheme = {
    ...(theme.isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(theme.isDark ? DarkTheme.colors : DefaultTheme.colors),
      // the navy end of the STM field: what shows for a frame between screens
      background: theme.colors.field[3],
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
            {/* the app bar again, with a back button before the logo */}
            <Stack.Screen name="MachineDetail" component={MachineDetailScreen} options={({ navigation }) => ({
              animation: 'slide_from_right',
              headerShown: true,
              header: () => (
                <AppBar onBack={() => navigation.goBack()} onProfile={() => navigation.navigate('Main', { screen: 'Profile' })} />
              ),
            })} />
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
