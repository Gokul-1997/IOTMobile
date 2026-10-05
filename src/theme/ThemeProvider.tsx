import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { lightColors, darkColors, ColorScheme } from './colors';
import { spacing, radius, typeScale, textScale, fontWeight, shadow } from './tokens';
import { getPref, setPref } from '../store/prefs';

export type ThemeMode = 'system' | 'light' | 'dark';
const MODE_KEY = 'mexa_theme_mode';

interface Theme {
  colors: ColorScheme;
  spacing: typeof spacing;
  radius: typeof radius;
  type: typeof typeScale;
  textScale: typeof textScale;
  weight: typeof fontWeight;
  shadow: typeof shadow;
  isDark: boolean;
  /** The person's choice; "system" follows the phone. */
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  // the saved choice, once on start
  useEffect(() => {
    getPref(MODE_KEY).then(v => {
      if (v === 'light' || v === 'dark' || v === 'system') setModeState(v);
    });
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    setPref(MODE_KEY, m);
  }, []);

  const isDark = mode === 'dark' || (mode === 'system' && scheme === 'dark');

  const theme = useMemo<Theme>(
    () => ({
      colors: isDark ? darkColors : lightColors,
      spacing,
      radius,
      type: typeScale,
      textScale,
      weight: fontWeight,
      shadow,
      isDark,
      mode,
      setMode,
    }),
    [isDark, mode, setMode]
  );

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
