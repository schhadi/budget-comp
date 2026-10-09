import { and, desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { challenges, screenshots, transactions, users } from "@/db/schema";
import { markNoSpendDay } from "@/actions/transactions";
import { Avatar } from "@/components/Avatar";
import { ChallengeForm } from "@/components/ChallengeForm";
import { Flash } from "@/components/Flash";
import { LeagueHeader } from "@/components/LeagueHeader";
import { SubmitButton } from "@/components/SubmitButton";
import { categoryInfo } from "@/lib/categories";
import { currentPeriod, daysBetween, formatDay, formatPeriod, todayIn } from "@/lib/dates";
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
    .select({ tx: transactions, user: { name: users.name, image: users.image }, shotUrl: screenshots.blobUrl })
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

  return (
    <div className="space-y-6">
      <LeagueHeader league={league} active="" isOwner={membership.role === "owner"} pendingCount={me?.pendingCount} />
      {error === "owner-only" && <Flash kind="error">Only the league owner can do that.</Flash>}

      <div className="card p-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-xs text-muted uppercase tracking-wide">{league.window === "weekly" ? "This week" : "This month"}</div>
          <div className="font-semibold">{formatPeriod(period)}</div>
          <div className="text-xs text-muted mt-0.5">{daysLeft === 0 ? "Last day!" : `${daysLeft} ${daysLeft === 1 ? "day" : "days"} left`}{league.stake ? ` · 🎯 ${league.stake}` : ""}</div>
        </div>
        <div className="flex flex-col gap-2 items-end">
          <Link href={`/leagues/${league.id}/upload`} className="btn btn-primary btn-sm">📸 Upload</Link>
          {!me?.loggedToday && (
            <form action={markNoSpendDay.bind(null, league.id, undefined)}>
              <SubmitButton className="btn btn-secondary btn-sm" pendingText="…">🧘 No spend today</SubmitButton>
            </form>
          )}
          {me?.loggedToday && <span className="text-xs text-good">Logged today ✓</span>}
        </div>
      </div>

      {me && me.pendingCount > 0 && (
        <Link href={`/leagues/${league.id}/review`} className="block">
          <Flash kind="info">You have {me.pendingCount} {me.pendingCount === 1 ? "entry" : "entries"} to confirm before they count →</Flash>
        </Link>
      )}

      <section className="space-y-2">
        <h2 className="font-semibold">Leaderboard <span className="text-muted font-normal text-sm">· lowest wins</span></h2>
        <ol className="space-y-2">
          {stats.members.map((m) => {
            const isMe = m.userId === user.id;
            const pct = league.budgetTargetMinor ? Math.min(100, Math.round((m.totalMinor / league.budgetTargetMinor) * 100)) : null;
            return (
              <li key={m.userId} className={`card p-3 ${isMe ? "border-accent/60" : ""}`}>
                <div className="flex items-center gap-3">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${m.rank <= 3 ? `rank-${m.rank}` : "bg-card-2 text-muted"}`}>{m.rank}</span>
                  <Avatar name={m.name} image={m.image} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{m.name}{isMe && <span className="text-muted text-xs"> (you)</span>}</div>
                    <div className="text-xs text-muted flex gap-2 flex-wrap">
                      <span>{m.txCount} {m.txCount === 1 ? "entry" : "entries"}</span>
                      <span>· {m.uploadDays}/{stats.daysElapsed} days logged</span>
                      {m.currentStreak >= 3 && <span>· 🔥 {m.currentStreak}</span>}
                      {m.penaltyMinor > 0 && <span className="text-bad">· +{formatMoney(m.penaltyMinor, league.currency)} penalty</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-semibold">{formatMoney(m.totalMinor, league.currency)}</div>
                    {m.topCategory && <div className="text-[11px] text-muted">{categoryInfo(m.topCategory.id).emoji} {m.topCategory.label}</div>}
                  </div>
                </div>
                {pct !== null && (
                  <div className="mt-2 h-1.5 rounded-full bg-card-2 overflow-hidden">
                    <div className={`h-full ${pct >= 100 ? "bg-bad" : pct >= 75 ? "bg-warn" : "bg-good"}`} style={{ width: `${pct}%` }} />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
        {league.budgetTargetMinor ? <p className="text-xs text-muted">Bar shows progress towards the {formatMoney(league.budgetTargetMinor, league.currency)} budget target.</p> : null}
        {excluded.size > 0 && <p className="text-xs text-muted">Not counted: {[...excluded].map((c) => categoryInfo(c).label).join(", ")}.</p>}
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Recent spending</h2>
        {recent.length === 0 && <p className="text-sm text-muted">Nothing confirmed yet. Be the first (or the most honest).</p>}
        <ul className="space-y-2">
          {recent.map(({ tx, user: u, shotUrl }) => {
            const ch = openChallenges.filter((c) => c.ch.transactionId === tx.id);
            const cat = categoryInfo(tx.category);
            return (
              <li key={tx.id} className="card p-3">
                <div className="flex items-center gap-3">
                  <Avatar name={u.name} image={u.image} size={30} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{cat.emoji} {tx.merchant}</div>
                    <div className="text-xs text-muted">{u.name?.split(" ")[0]} · {formatDay(tx.occurredOn)}{excluded.has(tx.category) ? " · not counted" : ""}</div>
                  </div>
                  <div className="font-mono text-sm">{formatMoney(tx.amountLeagueMinor, league.currency)}</div>
                  {shotUrl && <a href={shotUrl} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" title="View screenshot">🧾</a>}
                  {league.allowChallenges && tx.userId !== user.id && ch.length === 0 && <ChallengeForm txId={tx.id} />}
                </div>
                {ch.map((c) => (
                  <div key={c.ch.id} className="mt-2 text-xs text-warn">⚠️ Challenged by {c.raisedBy?.split(" ")[0]}: &ldquo;{c.ch.reason}&rdquo;</div>
                ))}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

