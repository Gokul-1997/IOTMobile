import React, { createContext, useContext } from 'react';
import { Text as NativeText, TextProps, StyleSheet, TextStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

const TextContext = createContext<{ weight?: TextStyle['fontWeight']; color?: TextStyle['color'] }>({});

/** The web app's Ubuntu typeface with native text scaling and nested text inheritance. */
export function ThemeText({ style, ref, ...props }: TextProps & { ref?: React.Ref<React.ComponentRef<typeof NativeText>> }) {
  const theme = useTheme();
  const inherited = useContext(TextContext);
  const resolved = StyleSheet.flatten(style);
  const weight = resolved?.fontWeight ?? inherited.weight ?? '400';
  const numericWeight = weight === 'bold' ? 700 : weight === 'normal' ? 400 : Number(weight);
  const family = resolved?.fontFamily ?? (numericWeight >= 600 ? theme.font.bold : numericWeight >= 500 ? theme.font.medium : theme.font.regular);
  const color = resolved?.color ?? inherited.color ?? theme.colors.textPrimary;

  return (
    <TextContext.Provider value={{ weight, color }}>
      <NativeText {...props} ref={ref} style={[{ color }, style, family ? { fontFamily: family, fontWeight: 'normal' } : undefined]} />
    </TextContext.Provider>
  );
}
