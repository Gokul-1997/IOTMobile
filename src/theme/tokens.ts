export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/* Tighter than a consumer app: panels on a shop-floor HMI are squared off,
   and 12px reads as an instrument panel rather than a bubble. */
export const radius = {
  sm: 6,
  md: 10,
  lg: 12,
  xl: 18,
  pill: 999,
} as const;

export const typeScale = {
  micro: 11,
  caption: 12,
  body: 15,
  bodyLarge: 17,
  subtitle: 19,
  title: 24,
  display: 32,
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  heavy: '800',
} as const;

export const shadow = {
  // cards float on the STM field, as on the web: a soft lift, no outline
  card: {
    shadowColor: '#120e40',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 5,
  },
  raised: {
    shadowColor: '#11142d',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 6,
  },
} as const;
