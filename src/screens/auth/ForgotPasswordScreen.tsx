import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthLayout, FormAlert } from '../../components/AuthLayout';
import { TextField } from '../../components/TextField';
import { Button } from '../../components/Button';
import { useTheme } from '../../theme/ThemeProvider';
import * as authApi from '../../api/auth';
import { RootStackParamList } from '../../navigation/types';

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

type Nav = NativeStackNavigationProp<RootStackParamList, 'ForgotPassword'>;

/*
 * Ask for a reset link. The answer is the same whether or not the address
 * has an account — saying which would tell a stranger who works here.
 */
export function ForgotPasswordScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [genericError, setGenericError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const trimmed = email.trim();
    if (!trimmed) { setEmailError('Enter your email address.'); return; }
    if (!isValidEmail(trimmed)) { setEmailError('That is not a valid email address.'); return; }
    setEmailError(undefined);
    setGenericError(null);
    setSubmitting(true);
    try {
      await authApi.forgotPassword(trimmed);
      setSent(true);
    } catch {
      setGenericError('Cannot send the link just now. Check the connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const back = (
    <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Back to sign in" hitSlop={12}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', minHeight: 36 }}>
      <Ionicons name="chevron-back" size={20} color={theme.colors.onHeader} />
      <Text style={{ color: theme.colors.onHeader, fontSize: 15, fontWeight: theme.weight.bold as any }}>Sign in</Text>
    </Pressable>
  );

  if (sent) {
    return (
      <AuthLayout title="Check your email" top={back}>
        <View style={{ alignItems: 'center', gap: theme.spacing.md, marginBottom: theme.spacing.xl }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: theme.colors.successBg, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="mail-open-outline" size={30} color={theme.colors.success} />
          </View>
          <Text style={{ fontSize: theme.type.body, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 22 }}>
            If an account exists for{' '}
            <Text style={{ color: theme.colors.textPrimary, fontWeight: theme.weight.bold as any }}>{email.trim()}</Text>,
            a link to reset the password is on its way. It works once, for a limited time.
          </Text>
        </View>
        <Button label="Back to sign in" variant="secondary" onPress={() => navigation.goBack()} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Reset your password" subtitle="Enter the email on your account and we will send a link to set a new password." top={back}>
      {genericError ? <FormAlert text={genericError} /> : null}
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        error={emailError}
        placeholder="you@company.com"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        returnKeyType="send"
        onSubmitEditing={handleSubmit}
      />
      <Button label="Send reset link" icon="send-outline" onPress={handleSubmit} loading={submitting} />
    </AuthLayout>
  );
}
