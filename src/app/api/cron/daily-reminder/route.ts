import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { dayLogs, leagues, memberships, transactions, users } from "@/db/schema";
import { cronAuthorised } from "@/lib/cron";
import { todayIn } from "@/lib/dates";
import { sendDailyReminder } from "@/lib/email";

export const maxDuration = 120;

/**
 * Runs once a day (see vercel.json). For every league that requires a daily upload,
 * emails each member who hasn't logged anything for "today" in the league's timezone.
 */
export async function GET(request: Request) {
  if (!cronAuthorised(request)) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const activeLeagues = await db.select().from(leagues).where(eq(leagues.dailyUploadRequired, true));
  const perUser = new Map<string, { email: string; name: string; leagues: { id: string; name: string; emoji: string }[] }>();

  for (const league of activeLeagues) {
    const today = todayIn(league.timezone);
    const members = await db
      .select({ id: users.id, email: users.email, name: users.name, reminderEmails: users.reminderEmails })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(eq(memberships.leagueId, league.id));
    const ids = members.map((m) => m.id);
    if (!ids.length) continue;

    const logged = new Set<string>();
    const logs = await db
      .select({ userId: dayLogs.userId })
      .from(dayLogs)
      .where(and(eq(dayLogs.leagueId, league.id), eq(dayLogs.day, today), inArray(dayLogs.userId, ids)));
    logs.forEach((l) => logged.add(l.userId));
    const txs = await db
      .select({ userId: transactions.userId })
      .from(transactions)
      .where(and(eq(transactions.leagueId, league.id), eq(transactions.occurredOn, today), inArray(transactions.userId, ids)));
    txs.forEach((t) => logged.add(t.userId));

    for (const m of members) {
      if (!m.email || !m.reminderEmails || logged.has(m.id)) continue;
      const entry = perUser.get(m.id) ?? { email: m.email, name: (m.name ?? "there").split(" ")[0], leagues: [] };
      entry.leagues.push({ id: league.id, name: league.name, emoji: league.emoji });
      perUser.set(m.id, entry);
    }
  }

  const results = await Promise.allSettled([...perUser.values()].map((u) => sendDailyReminder(u.email, u.name, u.leagues)));
  const sent = results.filter((r) => r.status === "fulfilled").length;
  return NextResponse.json({ ok: true, leagues: activeLeagues.length, reminded: sent });
}
