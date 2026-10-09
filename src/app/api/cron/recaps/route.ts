import { NextResponse } from "next/server";
import { db } from "@/db";
import { leagues } from "@/db/schema";
import { cronAuthorised } from "@/lib/cron";
import { addDays, todayIn, weekdayIndex } from "@/lib/dates";
import { ensureRecap, recapPeriod } from "@/lib/recap";

export const maxDuration = 300;

/**
 * Runs once a day. In each league's timezone:
 *  - on a Monday, generate the weekly Wrapped for the week that just ended
 *  - on the 1st, generate the monthly Wrapped for the month that just ended
 * Members are emailed a link. Already-generated recaps are skipped.
 */
export async function GET(request: Request) {
  if (!cronAuthorised(request)) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const all = await db.select().from(leagues);
  const out: { league: string; kind: string; created: boolean }[] = [];

  for (const league of all) {
    const today = todayIn(league.timezone);
    const yesterday = addDays(today, -1);
    try {
      if (league.weeklyRecap && weekdayIndex(today) === 0) {
        const { created } = await ensureRecap(league, "weekly", recapPeriod("weekly", yesterday), { email: true });
        out.push({ league: league.id, kind: "weekly", created });
      }
      if (league.monthlyRecap && today.endsWith("-01")) {
        const { created } = await ensureRecap(league, "monthly", recapPeriod("monthly", yesterday), { email: true });
        out.push({ league: league.id, kind: "monthly", created });
      }
    } catch (err) {
      console.error(`[recaps] failed for league ${league.id}`, err);
    }
  }

  return NextResponse.json({ ok: true, generated: out });
}
