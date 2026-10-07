/** The API and socket contract uses epoch seconds; older payloads may use ISO. */
export function telemetrySeconds(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null;
  const numeric = Number(value);
  const seconds = Number.isFinite(numeric) ? numeric : Date.parse(String(value)) / 1000;
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}
