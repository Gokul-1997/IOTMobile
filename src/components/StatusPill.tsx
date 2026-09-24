import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { StatusKey, statusColors } from '../theme/colors';

/* A machine's state as a word on its own tint — never colour alone. */
export function StatusPill({ status, size = 'md', onHeader = false }: { status: StatusKey; size?: 'sm' | 'md'; onHeader?: boolean }) {
  const theme = useTheme();
  const c = statusColors(theme.colors, status);
  const sm = size === 'sm';
  const bg = onHeader ? 'rgba(255,255,255,0.16)' : c.bg;
  const ink = onHeader ? '#ffffff' : c.ink;
  return (
    <View
      accessible
      accessibilityLabel={`Status ${c.label}`}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
        backgroundColor: bg, borderRadius: theme.radius.pill,
        paddingHorizontal: sm ? 8 : 10, paddingVertical: sm ? 3 : 5,
        borderWidth: onHeader ? 1 : 0, borderColor: 'rgba(255,255,255,0.28)',
      }}
    >
      <View style={{ width: sm ? 7 : 8, height: sm ? 7 : 8, borderRadius: 4, backgroundColor: c.dot }} />
      <Text style={{ fontSize: sm ? 11 : 12, fontWeight: theme.weight.bold as any, color: ink, letterSpacing: 0.6, textTransform: 'uppercase' }}>
        {c.label}
      </Text>
    </View>
  );
}
