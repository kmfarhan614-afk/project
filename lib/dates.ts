import type { DateRange, Period } from "./types";

const TIME_ZONE = "Asia/Karachi";
const OFFSET_MS = 5 * 60 * 60 * 1000;

export interface KarachiParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const partsFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export function karachiParts(date: Date | string = new Date()): KarachiParts {
  const d = typeof date === "string" ? new Date(date) : date;
  const parts = partsFormatter.formatToParts(d);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

export function karachiDateKey(date: Date | string = new Date()): string {
  const p = karachiParts(date);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function karachiTimeKey(date: Date | string): string {
  const p = karachiParts(date);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

function localMidnightUtcMs(year: number, month: number, day: number): number {
  return Date.UTC(year, month - 1, day) - OFFSET_MS;
}

function isoFromKey(key: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) throw new Error(`Invalid date key: ${key}`);
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

export function rangeForDateKey(key: string): DateRange {
  const { year, month, day } = isoFromKey(key);
  const from = localMidnightUtcMs(year, month, day);
  const to = localMidnightUtcMs(year, month, day + 1) - 1;
  return { from: new Date(from).toISOString(), to: new Date(to).toISOString() };
}

export function pktDateTimeToIso(dateKey: string, hour: number, minute = 0): string {
  const { year, month, day } = isoFromKey(dateKey);
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - OFFSET_MS).toISOString();
}

export function rangeFromKeys(fromKey: string, toKey: string): DateRange {
  const from = rangeForDateKey(fromKey).from;
  const to = rangeForDateKey(toKey).to;
  if (new Date(from).getTime() > new Date(to).getTime()) {
    throw new Error("Start date must be before end date.");
  }
  return { from, to };
}

export function addDaysToKey(key: string, days: number): string {
  const { year, month, day } = isoFromKey(key);
  const d = new Date(Date.UTC(year, month - 1, day + days, 12));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate(),
  ).padStart(2, "0")}`;
}

export function weekdayOfKey(key: string): number {
  const { year, month, day } = isoFromKey(key);
  return new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
}

export function startOfWeekKey(key: string): string {
  const weekday = weekdayOfKey(key);
  const diff = weekday === 0 ? 6 : weekday - 1;
  return addDaysToKey(key, -diff);
}

export function periodRange(period: Period, now: Date = new Date()): DateRange {
  const today = karachiDateKey(now);
  const p = karachiParts(now);
  let startKey = today;
  let endKey = today;
  if (period === "week") startKey = startOfWeekKey(today);
  if (period === "month") startKey = `${p.year}-${String(p.month).padStart(2, "0")}-01`;
  if (period === "year") startKey = `${p.year}-01-01`;
  return rangeFromKeys(startKey, endKey);
}

export function previousPeriodRange(period: Period, now: Date = new Date()): DateRange {
  const p = karachiParts(now);
  const today = karachiDateKey(now);
  if (period === "today") {
    const key = addDaysToKey(today, -1);
    return rangeForDateKey(key);
  }
  if (period === "week") {
    const start = startOfWeekKey(today);
    const prevEnd = addDaysToKey(start, -1);
    const prevStart = addDaysToKey(prevEnd, -6);
    return rangeFromKeys(prevStart, prevEnd);
  }
  if (period === "month") {
    const prevMonth = p.month === 1 ? 12 : p.month - 1;
    const prevYear = p.month === 1 ? p.year - 1 : p.year;
    const lastDay = new Date(Date.UTC(prevYear, prevMonth, 0, 12)).getUTCDate();
    return rangeFromKeys(
      `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`,
      `${prevYear}-${String(prevMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
    );
  }
  return rangeFromKeys(`${p.year - 1}-01-01`, `${p.year - 1}-12-31`);
}

export function previousEquivalentRange(range: DateRange): DateRange {
  const from = new Date(range.from).getTime();
  const to = new Date(range.to).getTime();
  const length = to - from + 1;
  const prevTo = from - 1;
  const prevFrom = prevTo - length + 1;
  return { from: new Date(prevFrom).toISOString(), to: new Date(prevTo).toISOString() };
}

export function daysBetween(range: DateRange): number {
  const from = new Date(range.from).getTime();
  const to = new Date(range.to).getTime();
  return Math.max(1, Math.round((to - from) / (24 * 60 * 60 * 1000)));
}

export function eachDayKey(range: DateRange): string[] {
  const startKey = karachiDateKey(range.from);
  const endKey = karachiDateKey(range.to);
  const out: string[] = [];
  let cursor = startKey;
  let guard = 0;
  while (cursor <= endKey && guard < 3700) {
    out.push(cursor);
    cursor = addDaysToKey(cursor, 1);
    guard += 1;
  }
  return out;
}

export function formatDayKey(key: string, opts?: { withYear?: boolean }): string {
  const { year, month, day } = isoFromKey(key);
  return new Intl.DateTimeFormat("en-PK", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    ...(opts?.withYear ? { year: "numeric" } : {}),
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

export function formatMonthKey(key: string): string {
  const { year, month } = isoFromKey(`${key}-01`);
  return new Intl.DateTimeFormat("en-PK", {
    timeZone: "UTC",
    month: "short",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, 1, 12)));
}

export function formatRangeLabel(range: DateRange): string {
  const from = karachiDateKey(range.from);
  const to = karachiDateKey(range.to);
  if (from === to) return formatDayKey(from, { withYear: true });
  return `${formatDayKey(from, { withYear: true })} – ${formatDayKey(to, { withYear: true })}`;
}

export function currentKarachiDateInput(now: Date = new Date()): string {
  return karachiDateKey(now);
}

export function weekdayName(key: string): string {
  const { year, month, day } = isoFromKey(key);
  return new Intl.DateTimeFormat("en-PK", {
    timeZone: "UTC",
    weekday: "long",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

export const PERIOD_LABELS: Record<Period, string> = {
  today: "Today",
  week: "This week",
  month: "This month",
  year: "This year",
};
