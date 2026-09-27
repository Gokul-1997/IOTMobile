import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeProvider';

/*
 * The STM field every screen stands on — the same diagonal as the web app
 * (MEXA_DS_dashboard_UI_02.pdf): crimson at the top right, navy at the
 * bottom left. The brand header sits straight on it and the white cards
 * float over it, so a screen reads as one surface instead of a coloured
 * band over a grey page.
 */
export function StmScreen({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const theme = useTheme();
  return (
    <View style={[{ flex: 1, backgroundColor: theme.colors.field[3] }, style]}>
      <LinearGradient
        colors={theme.colors.field}
        locations={[0, 0.36, 0.7, 1]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}
      />
      {children}
    </View>
  );
}
