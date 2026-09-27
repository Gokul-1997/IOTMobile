import React from 'react';
import { ScrollView, Pressable, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export interface FilterChip { key: string; label: string; count?: number; dot?: string }

/* A row of chips on the STM field — the web app's pill tabs: see-through
   white, the selected one solid white with navy text. Each is a real button
   that says it is selected, and at least 40pt tall for a gloved thumb. */
export function StatusFilter({ chips, value, onChange, accessibilityLabel }: {
  chips: FilterChip[]; value: string; onChange: (key: string) => void; accessibilityLabel: string;
}) {
  const theme = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel={accessibilityLabel}
      contentContainerStyle={{ gap: 8, paddingHorizontal: theme.spacing.lg, paddingVertical: 2 }}>
      {chips.map(c => {
        const on = c.key === value;
        return (
          <Pressable key={c.key} onPress={() => onChange(c.key)} accessibilityRole="button"
            accessibilityState={{ selected: on }} accessibilityLabel={`${c.label}${c.count != null ? `, ${c.count}` : ''}`}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 40, paddingHorizontal: 14,
              borderRadius: theme.radius.pill, borderWidth: 1,
              borderColor: on ? theme.colors.surface : theme.colors.fieldChipBorder,
              backgroundColor: on ? theme.colors.surface : pressed ? 'rgba(255,255,255,0.24)' : theme.colors.fieldChip,
            })}>
            {c.dot ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.dot }} /> : null}
            <Text style={{ fontSize: 13, fontWeight: theme.weight.bold as any, color: on ? theme.colors.accent : theme.colors.onField }}>
              {c.label}
            </Text>
            {c.count != null && (
              <Text style={{ fontSize: 13, fontWeight: theme.weight.bold as any, fontVariant: ['tabular-nums'],
                color: on ? theme.colors.textMuted : theme.colors.onFieldMuted }}>{c.count}</Text>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
