import { and, desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { challenges, screenshots, transactions, users } from "@/db/schema";
import { markNoSpendDay } from "@/actions/transactions";
import { Avatar } from "@/components/Avatar";
import { EntryRow } from "@/components/EntryRow";
import { Flash } from "@/components/Flash";
import { Icon } from "@/components/Icon";
import { LeagueHeader } from "@/components/LeagueHeader";
import { SectionHead } from "@/components/PageHeader";
import { SubmitButton } from "@/components/SubmitButton";
import { categoryInfo } from "@/lib/categories";
import { currentPeriod, daysBetween, formatPeriodShort, formatRelativeDay, todayIn } from "@/lib/dates";
import { requireMember } from "@/lib/league-access";
import { formatMoney } from "@/lib/money";
import { computeLeagueStats } from "@/lib/stats";

export default async function LeagueBoard({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const { error } = await searchParams;
  const { user, league, membership } = await requireMember(id);
  const period = currentPeriod(league.window, league.timezone);
  const stats = await computeLeagueStats(league, period);
  const me = stats.members.find((m) => m.userId === user.id);
  const today = todayIn(league.timezone);
  const daysLeft = daysBetween(today, period.end);

  const recent = await db
    .select({ tx: transactions, user: { name: users.name }, shotUrl: screenshots.blobUrl })
    .from(transactions)
    .innerJoin(users, eq(users.id, transactions.userId))
    .leftJoin(screenshots, eq(screenshots.id, transactions.screenshotId))
    .where(and(eq(transactions.leagueId, league.id), eq(transactions.status, "confirmed")))
    .orderBy(desc(transactions.confirmedAt))
    .limit(12);

  const openChallenges = recent.length
    ? await db
        .select({ ch: challenges, raisedBy: users.name })
        .from(challenges)
        .innerJoin(users, eq(users.id, challenges.raisedById))
        .where(and(eq(challenges.resolution, "open"), inArray(challenges.transactionId, recent.map((r) => r.tx.id))))
    : [];

  const excluded = new Set(league.excludedCategories ?? []);
  const pending = me?.pendingCount ?? 0;
  const footnote = [
    league.budgetTargetMinor ? `Bars show progress towards the ${formatMoney(league.budgetTargetMinor, league.currency)} budget target.` : null,
    excluded.size > 0 ? `${[...excluded].map((c) => categoryInfo(c).label).join(", ")} ${excluded.size === 1 ? "is" : "are"} not counted.` : null,
  ].filter(Boolean);

  return (
    <div className="rise flex flex-col">
      <LeagueHeader league={league} user={user} showSettings={membership.role === "owner"} />
      {error === "owner-only" && <Flash kind="error">Only the league owner can do that.</Flash>}

      <div className="flex items-end justify-between gap-3 px-4 pt-4 pb-1">
        <div>
          <div className="eyebrow">{league.window === "weekly" ? "This week" : "This month"}</div>
          <div className="mt-0.5 text-[26px] leading-[1.15] font-semibold tracking-[-0.02em]">{formatPeriodShort(period)}</div>
        </div>
        <div className="text-right">
          <div className="font-mono text-[26px] leading-[1.15] font-medium">{daysLeft}</div>
          <div className="text-xs text-muted">{daysLeft === 0 ? "last day" : daysLeft === 1 ? "day left" : "days left"}</div>
        </div>
      </div>
      <div className="flex items-center gap-1.5 border-b border-line px-4 pt-1.5 pb-4 text-[13px] text-ink2">
        {league.stake ? (
          <>
            <Icon name="emoji_events" size={16} className="text-muted" />
            {league.stake}
          </>
        ) : (
          <span className="text-muted">Lowest total wins.</span>
        )}
      </div>

      {pending > 0 && (
        <Link href={`/leagues/${league.id}/review`} className="flex min-h-14 items-center gap-3 border-b border-line bg-accent-soft px-4 py-3">
          <Icon name="fact_check" fill className="text-accent" />
          <span className="flex-1 text-[15px]">
            <strong className="font-semibold">
              {pending} {pending === 1 ? "entry" : "entries"}
            </strong>{" "}
            waiting for you to confirm
          </span>
          <Icon name="chevron_right" className="text-accent" />
        </Link>
      )}
      {me && !me.loggedToday && (
        <div className="flex min-h-14 items-center gap-3 border-b border-line py-2 pr-2 pl-4">
          <Icon name="schedule" className="text-warn" />
          <span className="flex-1 text-[15px]">Nothing logged today</span>
          <form action={markNoSpendDay.bind(null, league.id, undefined)}>
            <SubmitButton className="btn-outline" pendingText="Saving…">
              No spend today
            </SubmitButton>
          </form>
        </div>
      )}
      {me?.loggedToday && (
        <div className="flex min-h-14 items-center gap-3 border-b border-line px-4 py-3 text-good">
          <Icon name="check_circle" fill />
          <span className="flex-1 text-[15px] font-medium">Logged today</span>
        </div>
      )}

      <SectionHead label="Leaderboard" right="Lowest wins" className="pt-[22px]" />
      {stats.members.map((m, i) => {
        const isMe = m.userId === user.id;
        const pct = league.budgetTargetMinor ? Math.min(100, Math.round((m.totalMinor / league.budgetTargetMinor) * 100)) : null;
        const rankColor = i === 0 ? "text-accent" : isMe ? "text-ink" : "text-muted";
        const barColor = pct === null ? "" : pct >= 100 ? "bg-bad" : pct >= 75 ? "bg-warn" : "bg-good";
        return (
          <div key={m.userId} className="flex items-center gap-3 border-t border-line px-4 py-3">
            <div className={`w-[26px] shrink-0 text-center font-mono text-[22px] leading-none ${rankColor}`}>{m.rank}</div>
            <Avatar name={m.name} image={m.image} />
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="truncate text-[15px] font-semibold">{m.name}</span>
                {isMe && <span className="rounded bg-accent-soft px-[5px] py-px text-[11px] font-semibold tracking-[0.04em] text-accent">YOU</span>}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-muted">
                <span>
                  {m.txCount} {m.txCount === 1 ? "entry" : "entries"} · {m.uploadDays}/{stats.daysElapsed} days
                </span>
                {m.currentStreak >= 3 && (
                  <span className="inline-flex items-center gap-px text-warn">
                    <Icon name="local_fire_department" size={14} fill />
                    {m.currentStreak}
                  </span>
                )}
                {m.penaltyMinor > 0 && <span className="text-bad">+{formatMoney(m.penaltyMinor, league.currency)} penalty</span>}
              </div>
              {pct !== null && (
                <div className="mt-2 h-[3px] overflow-hidden rounded-sm bg-line">
                  <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
                </div>
              )}
            </div>
            <div className="shrink-0 text-right">
              <div className="font-mono text-base font-semibold">{formatMoney(m.totalMinor, league.currency)}</div>
              {m.topCategory && <div className="mt-0.5 text-xs text-muted">{categoryInfo(m.topCategory.id).short}</div>}
            </div>
          </div>
        );
      })}
      <div className="border-t border-line px-4 pt-2.5 text-xs text-muted">{footnote.join(" ")}</div>

      <SectionHead label="Recent spending" right={recent.length ? "Tap a row for actions" : undefined} />
      {recent.length === 0 && <div className="border-t border-line px-4 py-4 text-sm text-muted">Nothing confirmed yet. Be the first, or the most honest.</div>}
      {recent.map(({ tx, user: u, shotUrl }) => {
        const cat = categoryInfo(tx.category);
        const mine = tx.userId === user.id;
        const chs = openChallenges.filter((c) => c.ch.transactionId === tx.id);
        const meta = [mine ? "You" : (u.name ?? "Someone").split(" ")[0], formatRelativeDay(tx.occurredOn, today), cat.short, excluded.has(tx.category) ? "not counted" : null]
          .filter(Boolean)
          .join(" · ");
        return (
          <EntryRow
            key={tx.id}
            mode="board"
            txId={tx.id}
            icon={cat.icon}
            merchant={tx.merchant}
            meta={meta}
            amount={formatMoney(tx.amountLeagueMinor, league.currency)}
            shotUrl={shotUrl}
            challenges={chs.map((c) => ({ id: c.ch.id, by: c.ch.raisedById === user.id ? "you" : (c.raisedBy ?? "Someone").split(" ")[0], reason: c.ch.reason }))}
            canChallenge={league.allowChallenges && !mine && chs.length === 0}
          />
        );
      })}
      <div className="h-8" />
    </div>
  );
}
