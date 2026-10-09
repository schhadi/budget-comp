import { eq } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { leagues, memberships } from "@/db/schema";
import { Flash } from "@/components/Flash";
import { Icon } from "@/components/Icon";
import { JoinByCodeForm } from "@/components/JoinByCodeForm";
import { AccountLink } from "@/components/LeagueHeader";
import { currentPeriod, daysBetween, formatPeriodShort, ordinal, todayIn } from "@/lib/dates";
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
      return { league, period, stats, me, daysLeft: daysBetween(today, period.end) };
    }),
  );

  return (
    <div className="rise flex flex-col">
      <header className="topbar flex items-center justify-between gap-3 pr-2 pl-4">
        <h1 className="text-xl font-semibold tracking-[-0.01em]">Your leagues</h1>
        <div className="flex items-center gap-1">
          <Link href="/friends" aria-label="Friends" className="icon-btn">
            <Icon name="group" />
          </Link>
          <AccountLink user={user} />
        </div>
      </header>
      {error === "not-a-member" && <Flash kind="error">You&apos;re not in that league.</Flash>}
      {error === "owner-only" && <Flash kind="error">Only the league owner can do that.</Flash>}

      {cards.length === 0 && (
        <div className="border-b border-line px-4 py-6">
          <div className="text-[17px] font-semibold">No leagues yet</div>
          <p className="mt-1 text-sm text-muted">Create one and add your friends, or join with a code below.</p>
        </div>
      )}

      {cards.map(({ league, period, stats, me, daysLeft }) => {
        const leader = stats.members[0];
        const next = stats.members[1];
        const iLead = !!me && me.rank === 1;
        const other = iLead ? next : leader;
        const pending = me?.pendingCount ?? 0;
        const alerts = [
          pending > 0 ? { icon: "fact_check", text: `${pending} ${pending === 1 ? "entry" : "entries"} to confirm`, cls: "text-accent" } : null,
          league.dailyUploadRequired && me && !me.loggedToday ? { icon: "schedule", text: "Nothing logged today", cls: "text-warn" } : null,
        ].filter((a) => a !== null);
        return (
          <Link key={league.id} href={`/leagues/${league.id}`} className="block border-b border-line p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-[17px] font-semibold tracking-[-0.01em]">{league.name}</div>
                <div className="mt-0.5 text-xs text-muted">
                  {formatPeriodShort(period)} · {daysLeft === 0 ? "last day" : `${daysLeft} ${daysLeft === 1 ? "day" : "days"} left`}
                </div>
              </div>
              {me && (
                <div className="shrink-0 text-right">
                  <div className={`font-mono text-[22px] leading-none ${iLead ? "text-accent" : "text-ink"}`}>{ordinal(me.rank)}</div>
                  <div className="mt-[3px] text-[11px] text-muted">of {stats.members.length}</div>
                </div>
              )}
            </div>
            <div className="mt-3 flex justify-between text-[13px] text-ink2">
              <span>
                You <span className="font-mono text-ink">{formatMoney(me?.totalMinor ?? 0, league.currency)}</span>
              </span>
              {other && other.userId !== user.id && (
                <span>
                  {iLead ? "Next" : "Leader"}: {other.firstName} <span className="font-mono text-ink">{formatMoney(other.totalMinor, league.currency)}</span>
                </span>
              )}
            </div>
            {alerts.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-3 text-xs">
                {alerts.map((a) => (
                  <span key={a.text} className={`inline-flex items-center gap-1 ${a.cls}`}>
                    <Icon name={a.icon} size={14} fill />
                    {a.text}
                  </span>
                ))}
              </div>
            )}
          </Link>
        );
      })}

      <Link href="/leagues/new" className="flex min-h-14 items-center gap-3 border-b border-line px-4 py-3.5 text-[15px] font-semibold text-accent">
        <Icon name="add" />
        New league
      </Link>

      <div className="eyebrow px-4 pt-[26px] pb-2">Have an invite code?</div>
      <div className="px-4">
        <JoinByCodeForm />
      </div>
      <div className="h-10" />
    </div>
  );
}
