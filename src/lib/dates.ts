import type { LeagueWindow } from "@/db/schema";

/** YYYY-MM-DD for `date` in the given IANA timezone. */
export function todayIn(timezone: string, date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(startIso: string, endIso: string): number {
  const a = new Date(startIso + "T00:00:00Z").getTime();
  const b = new Date(endIso + "T00:00:00Z").getTime();
  return Math.round((b - a) / 86_400_000);
}

/** 0 = Monday ... 6 = Sunday */
export function weekdayIndex(iso: string): number {
  const d = new Date(iso + "T00:00:00Z").getUTCDay();
  return (d + 6) % 7;
}

export function isoDateValid(iso: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && !Number.isNaN(new Date(iso + "T00:00:00Z").getTime());
}

export interface Period {
  start: string; // inclusive
  end: string; // inclusive
}

export function weekContaining(iso: string): Period {
  const start = addDays(iso, -weekdayIndex(iso));
  return { start, end: addDays(start, 6) };
}

export function monthContaining(iso: string): Period {
  const start = iso.slice(0, 8) + "01";
  const d = new Date(start + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + 1);
  const nextMonth = d.toISOString().slice(0, 10);
  return { start, end: addDays(nextMonth, -1) };
}

export function periodContaining(window: LeagueWindow, iso: string): Period {
  return window === "weekly" ? weekContaining(iso) : monthContaining(iso);
}

export function previousPeriod(window: LeagueWindow, period: Period): Period {
  return periodContaining(window, addDays(period.start, -1));
}

export function currentPeriod(window: LeagueWindow, timezone: string): Period {
  return periodContaining(window, todayIn(timezone));
}

export function formatDay(iso: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...opts }).format(new Date(iso + "T00:00:00Z"));
}

export function formatPeriod(p: Period) {
  if (p.start.slice(0, 7) === p.end.slice(0, 7) && p.start.endsWith("-01")) {
    const monthEnd = monthContaining(p.start).end;
    if (monthEnd === p.end) return formatDay(p.start, { month: "long", year: "numeric" });
  }
  return `${formatDay(p.start)} – ${formatDay(p.end, { day: "numeric", month: "short", year: "numeric" })}`;
}

export function listDays(p: Period): string[] {
  const out: string[] = [];
  for (let d = p.start; d <= p.end; d = addDays(d, 1)) out.push(d);
  return out;
}
