/*
 * STM MEXA — mobile colours, taken from the web app so the two read as one
 * product:
 *
 *  - brand: the logo's navy → wine gradient, as the web's .bg-top-bar draws
 *    it (#2B3990 → #9B3F70); the logo's red tail is kept for the wordmark only.
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

  // the web top bar, and a deepened version for dark mode (the brand stays
  // recognisable instead of going flat black)
  headerGradient: ['#2B3990', '#9B3F70'] as const,
  headerGradientDark: ['#1A2257', '#4A2138'] as const,

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
  onAccent: string;
  onHeader: string;
  onHeaderMuted: string;
  headerGradient: readonly [string, string];
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
  onAccent: '#ffffff',
  onHeader: '#ffffff',
  onHeaderMuted: 'rgba(255,255,255,0.82)',
  headerGradient: palette.headerGradient,
  success: '#15803d', successBg: '#e7f6ec',
  warning: '#b45309', warningBg: '#fdf1e3',
  danger: '#c32b3f', dangerBg: '#fcecee',
  running: palette.running, runningBg: '#e7f6ec', runningInk: '#11652f',
  idle: palette.idle,       idleBg: '#fdf1e3',    idleInk: '#8a3f06',
  alarm: palette.alarm,     alarmBg: '#fcecee',   alarmInk: '#a11f31',
  offline: palette.offline, offlineBg: '#eef1f5', offlineInk: '#475467',
};

export const darkColors: ColorScheme = {
  background: '#0d0f15',
  surface: '#161a23',
  surfaceAlt: '#1d2230',
  border: '#252b39',
  textPrimary: '#e8ebf2',
  textSecondary: '#a8b0c2',
  textMuted: '#949eb2',
  accent: '#9fb3ff',
  accentPressed: '#bccbff',
  onAccent: '#10142b',
  onHeader: '#ffffff',
  onHeaderMuted: 'rgba(255,255,255,0.78)',
  headerGradient: palette.headerGradientDark,
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
