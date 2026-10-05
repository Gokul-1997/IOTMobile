import React, { useRef, useState } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthLayout, FormAlert } from '../../components/AuthLayout';
import { TextField } from '../../components/TextField';
import { Button } from '../../components/Button';
import { useTheme } from '../../theme/ThemeProvider';
import { useAuthStore } from '../../store/authStore';
import { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Login'>;

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function LoginScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const signIn = useAuthStore((s) => s.signIn);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const passwordRef = useRef<TextInput>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const errors: typeof fieldErrors = {};
    if (!email.trim()) errors.email = 'Enter your email address.';
    else if (!isValidEmail(email.trim())) errors.email = 'That is not a valid email address.';
    if (!password) errors.password = 'Enter your password.';

    setFieldErrors(errors);
    setFormError(null);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
    } catch (e: any) {
      /* In place, not a pop-up: an Alert says nothing on the web preview and
         takes the words away as soon as it is dismissed. */
      const status = e?.response?.status;
      setFormError(
        e?.response?.data?.message ??
        (status ? 'Sign in failed. Check your email and password and try again.'
                : 'Cannot reach the server. Check the connection and try again.')
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Sign in" subtitle="Use the account your company admin created for you.">
      {formError ? <FormAlert text={formError} /> : null}
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        error={fieldErrors.email}
        placeholder="you@company.com"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="username"
        returnKeyType="next"
        // Next goes on to the password with the keyboard still up
        submitBehavior="submit"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <TextField
        ref={passwordRef}
        label="Password"
        value={password}
        onChangeText={setPassword}
        error={fieldErrors.password}
        placeholder="Your password"
        secureTextEntry
        secureToggle
        autoComplete="password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={handleSubmit}
      />
      <Pressable onPress={() => navigation.navigate('ForgotPassword')} accessibilityRole="link" hitSlop={8}
        style={{ alignSelf: 'flex-end', marginTop: -theme.spacing.sm, marginBottom: theme.spacing.xl, minHeight: 32, justifyContent: 'center' }}>
        <Text style={{ color: theme.colors.accent, fontWeight: theme.weight.bold as any, fontSize: 14 }}>Forgot password?</Text>
      </Pressable>
      <Button label="Sign in" icon="log-in-outline" onPress={handleSubmit} loading={submitting} />
    </AuthLayout>
  );
}
