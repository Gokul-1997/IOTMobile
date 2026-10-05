import React from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView } from 'react-native';
import { StmScreen } from './StmScreen';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { useTheme } from '../theme/ThemeProvider';
import { BrandLogo } from './StmMexaLogo';

/*
 * The signed-out screens: the STM field, and on it one card opening with the
 * STM MEXA mark in its own colours and the product's name, then the form —
 * the web app's sign-in, at the size a first screen deserves.
 */
export function AuthLayout({ title, subtitle, children, top }: {
  title: string; subtitle?: string; children: React.ReactNode; top?: React.ReactNode;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const version = Constants.expoConfig?.version ?? '1.0.0';
  return (
    <StmScreen>
    {/* padding on Android too: the app draws edge to edge there, so Android no
        longer shrinks the window for the keyboard, and on a small phone the
        field being typed in sat under it */}
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" bounces={false}>
        <View style={{ paddingTop: insets.top + theme.spacing.lg, paddingHorizontal: theme.spacing.xl }}>
          {top}
        </View>

        {/* the card, centred on the field, opens with the original mark — as the web sign-in does */}
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.xl }}>
          <View style={[{ backgroundColor: theme.colors.surface, borderRadius: theme.radius.xl, padding: theme.spacing.xl }, theme.shadow.raised]}>
            <View style={{ alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.xl }}>
              <BrandLogo width={150} />
              <Text style={{ color: theme.colors.textMuted, fontSize: theme.type.micro, fontWeight: theme.weight.bold as any,
                letterSpacing: 2, textTransform: 'uppercase', textAlign: 'center' }}>
                Machine Monitoring System
              </Text>
            </View>
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
