// Calendar helpers on ISO dates ("YYYY-MM-DD"), computed in UTC so results
// never depend on the server's or the browser's timezone.

const DAY_MS = 86_400_000;

export function parseISO(d: string): number {
  const [y, m, dd] = d.split("-").map(Number);
  return Date.UTC(y, m - 1, dd);
}

export function toISO(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function isValidISO(d: unknown): d is string {
  return typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && toISO(parseISO(d)) === d;
}

export function addDays(d: string, n: number): string {
  return toISO(parseISO(d) + n * DAY_MS);
}

/** a - b in whole days. */
export function diffDays(a: string, b: string): number {
  return Math.round((parseISO(a) - parseISO(b)) / DAY_MS);
}

/** Monday = 0 ... Sunday = 6 */
export function dayOfWeek(d: string): number {
  return (new Date(parseISO(d)).getUTCDay() + 6) % 7;
}

export function monthOf(d: string): number {
  return Number(d.slice(5, 7));
}

export function daysInMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

export function monthKey(d: string): string {
  return d.slice(0, 7);
}

/** Today's date in India (the demo's home market), e.g. "2026-10-15". */
export function todayISO(timeZone = "Asia/Kolkata"): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function clampDate(d: string, min: string, max: string): string {
  if (diffDays(d, min) < 0) return min;
  if (diffDays(d, max) > 0) return max;
  return d;
}
