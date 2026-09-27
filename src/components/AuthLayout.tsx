import React from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { StmScreen } from './StmScreen';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { useTheme } from '../theme/ThemeProvider';
import { StmMexaLogo } from './StmMexaLogo';

/*
 * The signed-out screens: the STM field with the STM MEXA mark and the
 * product's name, and the form on a white card over it — the web app's
 * sign-in, at the size a first screen deserves.
 */
export function AuthLayout({ title, subtitle, children, top }: {
  title: string; subtitle?: string; children: React.ReactNode; top?: React.ReactNode;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const version = Constants.expoConfig?.version ?? '1.0.0';
  return (
    <StmScreen>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" bounces={false}>
        <View style={{ paddingTop: insets.top + theme.spacing.lg, paddingBottom: theme.spacing.xxl, paddingHorizontal: theme.spacing.xl }}>
          {top}
          <View style={{ alignItems: 'center', marginTop: theme.spacing.xl, gap: theme.spacing.md }}>
            <StmMexaLogo width={168} mono />
            <Text style={{ color: theme.colors.onHeaderMuted, fontSize: theme.type.micro, fontWeight: theme.weight.bold as any,
              letterSpacing: 2, textTransform: 'uppercase' }}>
              Machine Monitoring System
            </Text>
          </View>
        </View>

        <View style={{ flex: 1, paddingHorizontal: theme.spacing.lg }}>
          <View style={[{ backgroundColor: theme.colors.surface, borderRadius: theme.radius.xl, padding: theme.spacing.xl }, theme.shadow.raised]}>
            <Text accessibilityRole="header" style={{ fontSize: theme.type.title, fontWeight: theme.weight.heavy as any, color: theme.colors.textPrimary }}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={{ fontSize: theme.type.body, color: theme.colors.textSecondary, marginTop: 6, marginBottom: theme.spacing.xl, lineHeight: 21 }}>{subtitle}</Text>
            ) : <View style={{ height: theme.spacing.xl }} />}
            {children}
          </View>
        </View>

        <Text style={{ textAlign: 'center', color: theme.colors.onFieldMuted, fontSize: 12, paddingVertical: theme.spacing.xl, paddingBottom: insets.bottom + theme.spacing.lg }}>
          © STM MEXA · v{version}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
    </StmScreen>
  );
}

/* An inline message under a form: what went wrong, in words. */
export function FormAlert({ text, tone = 'danger' }: { text: string; tone?: 'danger' | 'success' }) {
  const theme = useTheme();
  const ink = tone === 'danger' ? theme.colors.danger : theme.colors.success;
  const bg = tone === 'danger' ? theme.colors.dangerBg : theme.colors.successBg;
  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="assertive"
      style={{ backgroundColor: bg, borderRadius: theme.radius.md, padding: theme.spacing.md, marginBottom: theme.spacing.lg }}>
      <Text style={{ color: ink, fontSize: 14, fontWeight: theme.weight.semibold as any, lineHeight: 20 }}>{text}</Text>
    </View>
  );
}
