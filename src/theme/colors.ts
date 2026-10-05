/*
 * STM MEXA — mobile colours, taken from the web app so the two read as one
 * product:
 *
 *  - brand: the STM field, the diagonal the web app draws behind every page
 *    (crimson top right → navy bottom left); dark mode trades it for a
 *    near-black ground. The logo is never recoloured in either theme.
 *  - neutrals: the MEXA dashboard tokens (_mexa.scss): ground #eef0f5,
 *    card #fff, ink #1f2430 / #4b5262 / #5d6679, rule #e3e6ef.
 *  - machine status: the same four colours the web uses everywhere — the
 *    status chips, the machine list, the shift timeline — Running green,
 *    Idle amber, Alarm red, Offline grey. Each has a darker ink for text on
 *    its own light tint (4.5:1 or better) so a status never relies on a dot.
 */
export const palette = {
  navy900: '#102B4E',
  navy700: '#2B3990',
  navy600: '#223070',
  wine600: '#863567',
  wine500: '#9B3F70',
  red500: '#EF4136',

  // the STM field behind every screen — the web app's page ground, as the
  // design PDF draws it: crimson top right to navy bottom left
  field: ['#b8404f', '#6e3b78', '#3f3a8c', '#2b3990'] as const,
  // dark mode is dark: a near-black ground with the faintest lift at the
  // top right, not the brand diagonal deepened (that read as purple)
  fieldDark: ['#161821', '#111319', '#0d0f14', '#0a0b0f'] as const,

  // the full logo gradient — hero surfaces only
  brandGradient: ['#2B3990', '#843D67', '#EF4136'] as const,

  running: '#22c55e',
  idle: '#f5a623',
  alarm: '#e03131',
  offline: '#94a3b8',

  white: '#ffffff',
} as const;

export interface ColorScheme {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentPressed: string;
  /* a primary button's fill and its label */
  primary: string;
  onPrimary: string;
  onHeader: string;
  onHeaderMuted: string;
  /* the STM field behind every screen, and what sits on it outside a card */
  field: readonly [string, string, string, string];
  onField: string;
  onFieldMuted: string;
  fieldChip: string;
  fieldChipBorder: string;
  /* a button standing on the field outside a card (Sign out, Try again) */
  fieldButton: string;
  fieldButtonInk: string;
  /* the top bar (logo, profile) and the tab bar */
  chrome: string;
  chromeBorder: string;
  success: string;
  successBg: string;
  warning: string;
  warningBg: string;
  danger: string;
  dangerBg: string;
  /* machine status: dot/bar colour, tint behind a pill, ink for text on it */
  running: string; runningBg: string; runningInk: string;
  idle: string;    idleBg: string;    idleInk: string;
  alarm: string;   alarmBg: string;   alarmInk: string;
  offline: string; offlineBg: string; offlineInk: string;
}

export const lightColors: ColorScheme = {
  background: '#eef0f5',
  surface: '#ffffff',
  surfaceAlt: '#f5f4fc',
  border: '#e3e6ef',
  textPrimary: '#1f2430',
  textSecondary: '#4b5262',
  textMuted: '#5d6679',
  accent: palette.navy700,
  accentPressed: palette.navy600,
  primary: palette.navy700,
  onPrimary: '#ffffff',
  onHeader: '#ffffff',
  onHeaderMuted: 'rgba(255,255,255,0.82)',
  field: palette.field,
  onField: '#ffffff',
  onFieldMuted: 'rgba(255,255,255,0.84)',
  fieldChip: 'rgba(255,255,255,0.14)',
  fieldChipBorder: 'rgba(255,255,255,0.32)',
  fieldButton: '#ffffff',
  fieldButtonInk: palette.navy700,
  chrome: '#ffffff',
  chromeBorder: '#e3e6ef',
  success: '#15803d', successBg: '#e7f6ec',
  warning: '#b45309', warningBg: '#fdf1e3',
  danger: '#c32b3f', dangerBg: '#fcecee',
  running: palette.running, runningBg: '#e7f6ec', runningInk: '#11652f',
  idle: palette.idle,       idleBg: '#fdf1e3',    idleInk: '#8a3f06',
  alarm: palette.alarm,     alarmBg: '#fcecee',   alarmInk: '#a11f31',
  offline: palette.offline, offlineBg: '#eef1f5', offlineInk: '#475467',
};

export const darkColors: ColorScheme = {
  background: '#0a0b0f',
  surface: '#171a21',
  surfaceAlt: '#1e222b',
  border: '#272c36',
  textPrimary: '#e8ebf2',
  textSecondary: '#a8b0c2',
  textMuted: '#949eb2',
  accent: '#9fb3ff',
  accentPressed: '#bccbff',
  // a solid brand blue, not the pale accent: white on it is 5.4:1, and it
  // stands 3:1 off a dark card
  primary: '#4a5be0',
  onPrimary: '#ffffff',
  onHeader: '#ffffff',
  onHeaderMuted: 'rgba(255,255,255,0.78)',
  field: palette.fieldDark,
  onField: '#ffffff',
  onFieldMuted: 'rgba(255,255,255,0.8)',
  fieldChip: 'rgba(255,255,255,0.08)',
  fieldChipBorder: 'rgba(255,255,255,0.18)',
  fieldButton: '#1e222b',
  fieldButtonInk: '#e8ebf2',
  chrome: '#111318',
  chromeBorder: '#22262f',
  success: '#4ade80', successBg: '#12291b',
  warning: '#fbbf24', warningBg: '#2b2416',
  danger: '#f87171',  dangerBg: '#331719',
  running: palette.running, runningBg: '#12291b', runningInk: '#7fdca3',
  idle: palette.idle,       idleBg: '#2b2416',    idleInk: '#f5c28a',
  alarm: palette.alarm,     alarmBg: '#331719',   alarmInk: '#ffa9b4',
  offline: palette.offline, offlineBg: '#1f2531', offlineInk: '#c3cad6',
};

export type StatusKey = 'RUNNING' | 'IDLE' | 'ALARM' | 'OFFLINE';

/** A machine's display state: an alarm outranks the status it reports. */
export function statusKey(status: string | null | undefined, alarm?: boolean): StatusKey {
  if (alarm) return 'ALARM';
  const s = String(status || '').toUpperCase();
  if (s === 'RUNNING' || s === 'RUN' || s === 'CUTTING') return 'RUNNING';
  if (s === 'IDLE') return 'IDLE';
  return 'OFFLINE';
}

export function statusColors(c: ColorScheme, key: StatusKey) {
  switch (key) {
    case 'RUNNING': return { dot: c.running, bg: c.runningBg, ink: c.runningInk, label: 'Running' };
    case 'IDLE':    return { dot: c.idle,    bg: c.idleBg,    ink: c.idleInk,    label: 'Idle' };
    case 'ALARM':   return { dot: c.alarm,   bg: c.alarmBg,   ink: c.alarmInk,   label: 'Alarm' };
    default:        return { dot: c.offline, bg: c.offlineBg, ink: c.offlineInk, label: 'Offline' };
  }
}
