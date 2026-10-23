import React, { useState } from 'react';
import { View, TextInput, StyleSheet, TextInputProps, Pressable } from 'react-native';
import { ThemeText as Text } from './ThemeText';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../theme/ThemeProvider';

interface TextFieldProps extends TextInputProps {
  /** the input itself, so a form can move focus to it */
  ref?: React.Ref<TextInput>;
  label: string;
  error?: string | null;
  secureToggle?: boolean;
}

export function TextField({ label, error, secureToggle, secureTextEntry, onFocus, onBlur, ...rest }: TextFieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(!!secureTextEntry);

  const borderColor = error ? theme.colors.danger : focused ? theme.colors.accent : theme.colors.border;

  return (
    <View style={{ marginBottom: theme.spacing.lg }}>
      <Text
        style={{
          fontSize: theme.type.caption,
          fontWeight: theme.weight.semibold as any,
          color: theme.colors.textSecondary,
          marginBottom: theme.spacing.xs,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
        }}
      >
        {label}
      </Text>
      <View
        style={[
          styles.row,
          {
            borderColor,
            borderRadius: theme.radius.md,
            backgroundColor: theme.colors.surface,
            paddingHorizontal: theme.spacing.md,
          },
        ]}
      >
        <TextInput
          {...rest}
          accessibilityLabel={rest.accessibilityLabel ?? label}
          accessibilityHint={error || rest.accessibilityHint}
          secureTextEntry={secureToggle ? hidden : secureTextEntry}
          onFocus={event => { setFocused(true); onFocus?.(event); }}
          onBlur={event => { setFocused(false); onBlur?.(event); }}
          placeholderTextColor={theme.colors.textMuted}
          style={[
            styles.input,
            { color: theme.colors.textPrimary, fontSize: theme.type.body, fontFamily: theme.font.regular },
          ]}
        />
        {secureToggle && (
          <Pressable onPress={() => setHidden((v) => !v)} accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
            style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons
              name={hidden ? 'eye-outline' : 'eye-off-outline'}
              size={20}
              color={theme.colors.textMuted}
            />
          </Pressable>
        )}
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={{ color: theme.colors.danger, fontSize: theme.type.caption, marginTop: theme.spacing.xs }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
  },
});
