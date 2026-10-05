import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

/*
 * The page's own header, under the app bar (AppBar: the logo and the
 * profile) and standing on the STM field: a small eyebrow line (company ·
 * shift), the title, and `right` on the title's line for a live clock, a
 * state or an action; `children` for anything that belongs on the field,
 * such as the fleet utilisation dial.
 */
export function BrandHeader({ title, eyebrow, right, children }: {
  title: string;
  eyebrow?: string;
  right?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const theme = useTheme();
  // no background of its own: the header stands on the screen's STM field
  return (
    <View style={{ paddingTop: theme.spacing.lg, paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          {eyebrow ? (
            <Text numberOfLines={1} style={{ color: theme.colors.onHeaderMuted, fontSize: theme.type.micro, fontWeight: theme.weight.bold as any, letterSpacing: 1, textTransform: 'uppercase' }}>
              {eyebrow}
            </Text>
          ) : null}
          <Text accessibilityRole="header" numberOfLines={1}
            style={{ color: theme.colors.onHeader, fontSize: theme.type.title, fontWeight: theme.weight.heavy as any, letterSpacing: -0.3, marginTop: 2 }}>
            {title}
          </Text>
        </View>
        {right ? <View style={{ flexShrink: 0 }}>{right}</View> : null}
      </View>
      {children}
    </View>
  );
}

/* "LIVE" with a dot, or how long ago the data landed. */
export function LiveTag({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.14)',
      borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: theme.colors.running }} />
      <Text maxFontSizeMultiplier={theme.textScale.figure} style={{ color: theme.colors.onHeader, fontSize: 11, fontWeight: theme.weight.bold as any, letterSpacing: 0.6 }}>{label}</Text>
    </View>
  );
}
