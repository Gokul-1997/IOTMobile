import React from 'react';
import { View, Text } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../theme/ThemeProvider';
import { Button } from './Button';

/* What a screen shows when it has nothing to show — said plainly, with the
   one thing to do about it, if there is one. It stands on the STM field, so
   its text is white. */
export function EmptyState({ icon, title, message, actionLabel, onAction, tone = 'neutral' }: {
  icon: keyof typeof Ionicons.glyphMap; title: string; message?: string;
  actionLabel?: string; onAction?: () => void; tone?: 'neutral' | 'danger';
}) {
  const theme = useTheme();
  const tint = tone === 'danger' ? '#ffb4bd' : theme.colors.onField;
  const tintBg = tone === 'danger' ? 'rgba(224,49,49,0.28)' : theme.colors.fieldChip;
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', padding: theme.spacing.xl, gap: theme.spacing.md }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: tintBg, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={30} color={tint} />
      </View>
      <Text accessibilityRole="header" style={{ fontSize: theme.type.bodyLarge, fontWeight: theme.weight.bold as any, color: theme.colors.onField, textAlign: 'center' }}>
        {title}
      </Text>
      {message ? (
        <Text style={{ fontSize: theme.type.body, color: theme.colors.onFieldMuted, textAlign: 'center', lineHeight: 21, maxWidth: 320 }}>{message}</Text>
      ) : null}
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} variant="onField" style={{ minWidth: 160, marginTop: 4 }} /> : null}
    </View>
  );
}

export function NoAccess({ what }: { what: string }) {
  return (
    <EmptyState icon="lock-closed-outline" title={`No access to ${what}`}
      message="Your role has not been given this screen. Ask your company admin if you need it." />
  );
}
