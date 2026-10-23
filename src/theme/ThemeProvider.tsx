import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, useColorScheme } from 'react-native';
import { useFonts } from 'expo-font';
import { lightColors, darkColors, ColorScheme } from './colors';
import { spacing, radius, typeScale, textScale, fontWeight, fontFamily, shadow } from './tokens';
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
  font: { regular: string | undefined; medium: string | undefined; bold: string | undefined };
  shadow: typeof shadow;
  isDark: boolean;
  reduceMotion: boolean;
  /** The person's choice; "system" follows the phone. */
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [fontsLoaded, fontError] = useFonts({
    [fontFamily.regular]: require('../../assets/fonts/Ubuntu-Regular.ttf'),
    [fontFamily.medium]: require('../../assets/fonts/Ubuntu-Medium.ttf'),
    [fontFamily.bold]: require('../../assets/fonts/Ubuntu-Bold.ttf'),
  });
  const scheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (alive) setReduceMotion(value); });
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { alive = false; listener.remove(); };
  }, []);

  // the saved choice, once on start
  useEffect(() => {
    let alive = true;
    getPref(MODE_KEY).then(v => {
      if (alive && (v === 'light' || v === 'dark' || v === 'system')) setModeState(v);
    });
    return () => { alive = false; };
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
      font: fontsLoaded ? fontFamily : { regular: undefined, medium: undefined, bold: undefined },
      shadow: isDark ? {
        card: { ...shadow.card, shadowColor: '#000000', shadowOpacity: 0.35 },
        raised: { ...shadow.raised, shadowColor: '#000000', shadowOpacity: 0.3 },
      } : shadow,
      isDark,
      reduceMotion,
      mode,
      setMode,
    }),
    [isDark, reduceMotion, mode, setMode, fontsLoaded]
  );

  // Keep the existing splash visible while bundled fonts load. A font failure
  // falls back to the system font so sign-in always remains available.
  if (!fontsLoaded && !fontError) return null;

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
