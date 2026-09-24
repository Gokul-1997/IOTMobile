import React from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { useTheme } from '../theme/ThemeProvider';
import { StmMexaLogo } from './StmMexaLogo';

/*
 * The signed-out screens: the brand gradient with the STM MEXA mark, the
 * product's name, and the form on a sheet rising over it — the same identity
 * as the web app's top bar, at the size a first screen deserves.
 */
export function AuthLayout({ title, subtitle, children, top }: {
  title: string; subtitle?: string; children: React.ReactNode; top?: React.ReactNode;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [from, to] = theme.colors.headerGradient;
  const version = Constants.expoConfig?.version ?? '1.0.0';
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" bounces={false}>
        <LinearGradient colors={[from, to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ paddingTop: insets.top + theme.spacing.lg, paddingBottom: 72, paddingHorizontal: theme.spacing.xl }}>
          {top}
          <View style={{ alignItems: 'center', marginTop: theme.spacing.xl, gap: theme.spacing.md }}>
            <StmMexaLogo width={168} mono />
            <Text style={{ color: theme.colors.onHeaderMuted, fontSize: theme.type.micro, fontWeight: theme.weight.bold as any,
              letterSpacing: 2, textTransform: 'uppercase' }}>
              Machine Monitoring System
            </Text>
          </View>
        </LinearGradient>

        <View style={{ flex: 1, marginTop: -44, paddingHorizontal: theme.spacing.lg }}>
          <View style={[{ backgroundColor: theme.colors.surface, borderRadius: theme.radius.xl, padding: theme.spacing.xl,
            borderWidth: 1, borderColor: theme.colors.border }, theme.shadow.raised]}>
            <Text accessibilityRole="header" style={{ fontSize: theme.type.title, fontWeight: theme.weight.heavy as any, color: theme.colors.textPrimary }}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={{ fontSize: theme.type.body, color: theme.colors.textSecondary, marginTop: 6, marginBottom: theme.spacing.xl, lineHeight: 21 }}>{subtitle}</Text>
            ) : <View style={{ height: theme.spacing.xl }} />}
            {children}
          </View>
        </View>

        <Text style={{ textAlign: 'center', color: theme.colors.textMuted, fontSize: 12, paddingVertical: theme.spacing.xl, paddingBottom: insets.bottom + theme.spacing.lg }}>
          © STM MEXA · v{version}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
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
