import React from 'react';
import { View, Text, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

/*
 * A panel. With a `title`, it carries the small uppercase label an
 * instrument panel would — the value underneath is what is read, the label
 * only says what it is.
 */
export function Card({ children, style, title, right, padded = true }: {
  children: React.ReactNode;
  style?: ViewStyle;
  title?: string;
  right?: React.ReactNode;
  padded?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radius.lg,
          padding: padded ? theme.spacing.lg : 0,
        },
        theme.shadow.card,
        style,
      ]}
    >
      {(title || right) && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.md, gap: 8 }}>
          {title ? <PanelLabel>{title}</PanelLabel> : <View />}
          {right}
        </View>
      )}
      {children}
    </View>
  );
}

export function PanelLabel({ children, color }: { children: React.ReactNode; color?: string }) {
  const theme = useTheme();
  return (
    <Text
      accessibilityRole="header"
      style={{
        fontSize: theme.type.micro,
        fontWeight: theme.weight.bold as any,
        color: color ?? theme.colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 1,
      }}
    >
      {children}
    </Text>
  );
}
