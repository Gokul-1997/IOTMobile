import React from 'react';
import { Pressable, Text, ActivityIndicator, ViewStyle, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../theme/ThemeProvider';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'onField';
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  compact?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

/* One button, five jobs: primary (the one action), secondary (outlined),
   danger (irreversible), ghost (quiet), onField (white — a dark tile in dark
   mode — for a button that stands on the field outside a card). 48pt tall,
   36 when compact. */
export function Button({ label, onPress, variant = 'primary', icon, loading, disabled, compact, style, accessibilityLabel }: ButtonProps) {
  const theme = useTheme();
  const off = disabled || loading;
  const fill =
    variant === 'primary' ? theme.colors.primary :
    variant === 'danger' ? theme.colors.danger :
    variant === 'onField' ? theme.colors.fieldButton : 'transparent';
  const ink =
    variant === 'primary' ? theme.colors.onPrimary :
    variant === 'danger' ? '#ffffff' :
    variant === 'onField' ? theme.colors.fieldButtonInk :
    variant === 'secondary' ? theme.colors.accent : theme.colors.textSecondary;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: off, busy: !!loading }}
      style={({ pressed }) => [
        {
          minHeight: compact ? 36 : 48,
          paddingHorizontal: compact ? 12 : 18,
          borderRadius: theme.radius.md,
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: off && variant === 'primary' ? theme.colors.border : fill,
          borderWidth: variant === 'secondary' ? 1.5 : 0,
          borderColor: theme.colors.accent,
          opacity: pressed && !off ? 0.86 : off && variant !== 'primary' ? 0.5 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={ink} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {icon ? <Ionicons name={icon} size={compact ? 16 : 18} color={ink} /> : null}
          <Text style={{ color: ink, fontSize: compact ? 13 : theme.type.body, fontWeight: theme.weight.bold as any, letterSpacing: 0.2 }}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
