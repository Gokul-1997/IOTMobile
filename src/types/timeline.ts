/** GET /dashboard/live/:id/timeline — the current shift, period by period. */
export type TimelineState = 'RUNNING' | 'IDLE' | 'ALARM' | 'OFF';

export interface TimelineSegment { state: TimelineState; from: number; to: number; }
export interface TimelineBreak { name: string; from: number; to: number; }

export interface MachineTimeline {
  shift: { id: number; code: string; name: string | null; start: number; end: number; break_minutes: number } | null;
  now: number;
  segments: TimelineSegment[];
  breaks: TimelineBreak[];
  breaks_configured: boolean;
  totals: { elapsed: number; RUNNING: number; IDLE: number; ALARM: number; OFF: number; breaks: number } | null;
}
