/**
 * Period boundaries in Australia/Brisbane. Brisbane is UTC+10 all year (Queensland has no
 * daylight saving), so a fixed offset is exact and avoids Intl timezone edge cases.
 */
export const TZ_OFFSET_MS = 10 * 60 * 60 * 1000;
export const TZ_NAME = 'Australia/Brisbane';

export type Period = 'week' | 'month' | 'year' | 'all';

/** Fields of the Brisbane wall-clock date for an instant. */
function local(ms: number) {
  const d = new Date(ms + TZ_OFFSET_MS);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), day: d.getUTCDate(), dow: d.getUTCDay() };
}

/** Epoch ms of Brisbane midnight on the given wall-clock date. */
function midnight(y: number, m: number, day: number): number {
  return Date.UTC(y, m, day) - TZ_OFFSET_MS;
}

/** Start (inclusive) of the period containing `now`, or -Infinity for all time. */
export function periodStart(period: Period, now: number): number {
  const { y, m, day, dow } = local(now);
  switch (period) {
    case 'week': {
      const sinceMonday = (dow + 6) % 7; // Monday = 0
      return midnight(y, m, day - sinceMonday);
    }
    case 'month':
      return midnight(y, m, 1);
    case 'year':
      return midnight(y, 0, 1);
    case 'all':
      return -Infinity;
  }
}

export function inPeriod(ms: number, period: Period, now: number): boolean {
  return ms >= periodStart(period, now) && ms <= now;
}

const fmt = new Intl.DateTimeFormat('en-AU', { timeZone: TZ_NAME, day: 'numeric', month: 'short', year: 'numeric' });
const fmtTime = new Intl.DateTimeFormat('en-AU', { timeZone: TZ_NAME, hour: 'numeric', minute: '2-digit' });

export const formatDate = (ms: number) => fmt.format(ms);
export const formatDateTime = (ms: number) => `${fmt.format(ms)}, ${fmtTime.format(ms)}`;
