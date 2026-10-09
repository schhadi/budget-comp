import { eq } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { leagues, memberships } from "@/db/schema";
import { JoinByCodeForm } from "@/components/JoinByCodeForm";
import { Flash } from "@/components/Flash";
import { currentPeriod, daysBetween, formatPeriod, todayIn } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { requireUser } from "@/lib/session";
import { computeLeagueStats } from "@/lib/stats";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await requireUser();
  const { error } = await searchParams;

  const mine = await db
    .select({ league: leagues })
    .from(memberships)
    .innerJoin(leagues, eq(leagues.id, memberships.leagueId))
    .where(eq(memberships.userId, user.id));

  const cards = await Promise.all(
    mine.map(async ({ league }) => {
      const period = currentPeriod(league.window, league.timezone);
      const stats = await computeLeagueStats(league, period);
      const me = stats.members.find((m) => m.userId === user.id);
      const today = todayIn(league.timezone);
      return { league, period, stats, me, daysLeft: daysBetween(today, period.end), loggedToday: me?.loggedToday ?? false };
    }),
  );

  return (
    <div className="space-y-6">
      {error === "not-a-member" && <Flash kind="error">You&apos;re not in that league.</Flash>}
      {error === "owner-only" && <Flash kind="error">Only the league owner can do that.</Flash>}

      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Your leagues</h1>
        <Link href="/leagues/new" className="btn btn-primary btn-sm">+ New league</Link>
      </div>

      {cards.length === 0 && (
        <div className="card p-6 text-center">
          <div className="text-4xl">🫥</div>
          <p className="mt-3 font-medium">No leagues yet.</p>
          <p className="text-sm text-muted mt-1">Create one and add your friends, or join with a code.</p>
        </div>
      )}

      <div className="grid gap-3">
        {cards.map(({ league, period, stats, me, daysLeft, loggedToday }) => {
          const leader = stats.members[0];
          const pending = me?.pendingCount ?? 0;
          return (
            <Link key={league.id} href={`/leagues/${league.id}`} className="card p-4 hover:border-accent transition block">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-lg">{league.emoji} {league.name}</div>
                  <div className="text-xs text-muted">{formatPeriod(period)} · {daysLeft === 0 ? "last day" : `${daysLeft} days left`}</div>
                </div>
                {me && (
                  <div className="text-right">
                    <div className={`inline-flex w-9 h-9 rounded-full items-center justify-center font-bold ${me.rank <= 3 ? `rank-${me.rank}` : "bg-card-2"}`}>#{me.rank}</div>
                  </div>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-muted">You: <span className="text-foreground font-mono">{formatMoney(me?.totalMinor ?? 0, league.currency)}</span></span>
                {leader && leader.userId !== user.id && (
                  <span className="text-muted">Leader: {leader.firstName} <span className="font-mono text-foreground">{formatMoney(leader.totalMinor, league.currency)}</span></span>
                )}
                {leader && leader.userId === user.id && <span className="text-good">You&apos;re winning 🥇</span>}
              </div>
              {pending > 0 && <div className="mt-2 text-xs text-warn">{pending} {pending === 1 ? "entry" : "entries"} waiting for your confirmation</div>}
              {league.dailyUploadRequired && !loggedToday && <div className="mt-2 text-xs text-bad">Nothing logged today yet</div>}
            </Link>
          );
        })}
      </div>

      <div className="card p-4 space-y-2">
        <div className="font-medium">Have an invite code?</div>
        <JoinByCodeForm />
      </div>
    </div>
  );
}
