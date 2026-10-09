import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import { badges, challenges, screenshots, transactions, users } from "@/db/schema";
import { deleteTransaction, resolveChallenge } from "@/actions/transactions";
import { LeagueHeader } from "@/components/LeagueHeader";
import { categoryInfo } from "@/lib/categories";
import { currentPeriod, formatDay, formatPeriod, listDays } from "@/lib/dates";
import { requireMember } from "@/lib/league-access";
import { formatMoney } from "@/lib/money";
import { computeLeagueStats } from "@/lib/stats";

export default async function MePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, league, membership } = await requireMember(id);
  const period = currentPeriod(league.window, league.timezone);
  const stats = await computeLeagueStats(league, period);
  const me = stats.members.find((m) => m.userId === user.id);

  const mine = await db
    .select({ tx: transactions, shotUrl: screenshots.blobUrl })
    .from(transactions)
    .leftJoin(screenshots, eq(screenshots.id, transactions.screenshotId))
    .where(and(eq(transactions.leagueId, league.id), eq(transactions.userId, user.id), eq(transactions.status, "confirmed"), gte(transactions.occurredOn, period.start), lte(transactions.occurredOn, period.end)))
    .orderBy(desc(transactions.occurredOn), desc(transactions.createdAt));

  const myChallenges = mine.length
    ? await db
        .select({ ch: challenges, raisedBy: users.name })
        .from(challenges)
        .innerJoin(users, eq(users.id, challenges.raisedById))
        .where(and(eq(challenges.resolution, "open"), inArray(challenges.transactionId, mine.map((m) => m.tx.id))))
    : [];

  const myBadges = await db.select().from(badges).where(and(eq(badges.leagueId, league.id), eq(badges.userId, user.id))).orderBy(desc(badges.createdAt)).limit(12);

  const cats = Object.entries(me?.byCategory ?? {}).sort((a, b) => b[1] - a[1]);
  const maxCat = cats[0]?.[1] ?? 1;
  const days = listDays(period);
  const maxDay = Math.max(1, ...Object.values(me?.byDay ?? {}));
  const excluded = new Set(league.excludedCategories ?? []);

  return (
    <div className="space-y-6">
      <LeagueHeader league={league} active="/me" isOwner={membership.role === "owner"} pendingCount={me?.pendingCount} />

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Total" value={formatMoney(me?.totalMinor ?? 0, league.currency)} />
        <Stat label="Rank" value={me ? `#${me.rank}` : "–"} />
        <Stat label="Days logged" value={`${me?.uploadDays ?? 0}/${stats.daysElapsed}`} />
      </div>
      {me && me.penaltyMinor > 0 && <p className="text-xs text-bad">Includes {formatMoney(me.penaltyMinor, league.currency)} in missed-day penalties ({me.missedDays} days).</p>}

      {myBadges.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold">Badges</h2>
          <div className="flex flex-wrap gap-2">
            {myBadges.map((b) => (
              <span key={b.id} className="pill" title={`${formatDay(b.periodStart)} – ${formatDay(b.periodEnd)}`}>{b.emoji} {b.label}</span>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="font-semibold">By category <span className="text-muted text-sm font-normal">· {formatPeriod(period)}</span></h2>
        {cats.length === 0 && <p className="text-sm text-muted">No counted spending yet this period.</p>}
        {cats.map(([cid, minor]) => {
          const c = categoryInfo(cid);
          return (
            <div key={cid} className="text-sm">
              <div className="flex justify-between"><span>{c.emoji} {c.label}</span><span className="font-mono">{formatMoney(minor, league.currency)}</span></div>
              <div className="h-1.5 rounded-full bg-card-2 mt-1 overflow-hidden"><div className="h-full bg-accent" style={{ width: `${Math.round((minor / maxCat) * 100)}%` }} /></div>
            </div>
          );
        })}
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">By day</h2>
        <div className="flex items-end gap-1 h-24">
          {days.map((d) => {
            const v = me?.byDay[d] ?? 0;
            return (
              <div key={d} className="flex-1 flex flex-col items-center gap-1" title={`${formatDay(d)}: ${formatMoney(v, league.currency)}`}>
                <div className="w-full rounded-t bg-accent-2/70" style={{ height: `${Math.max(2, Math.round((v / maxDay) * 80))}px` }} />
                {league.window === "weekly" && <span className="text-[10px] text-muted">{formatDay(d, { weekday: "narrow" })}</span>}
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Your entries</h2>
        {mine.length === 0 && <p className="text-sm text-muted">Nothing yet.</p>}
        {mine.map(({ tx, shotUrl }) => {
          const chs = myChallenges.filter((c) => c.ch.transactionId === tx.id);
          const c = categoryInfo(tx.category);
          return (
            <div key={tx.id} className="card p-3">
              <div className="flex items-center gap-3">
                <span className="text-xl">{c.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{tx.merchant}</div>
                  <div className="text-xs text-muted">{formatDay(tx.occurredOn)} · {c.label}{excluded.has(tx.category) ? " · not counted" : ""}{tx.currency !== league.currency ? ` · ${formatMoney(tx.amountMinor, tx.currency)}` : ""}</div>
                </div>
                <div className="font-mono text-sm">{formatMoney(tx.amountLeagueMinor, league.currency)}</div>
                {shotUrl && <a href={shotUrl} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">🧾</a>}
                <form action={deleteTransaction.bind(null, tx.id)}><button className="btn btn-ghost btn-sm" title="Delete">🗑️</button></form>
              </div>
              {chs.map((ch) => (
                <div key={ch.ch.id} className="mt-2 rounded-xl bg-warn/10 border border-warn/30 p-2 text-xs">
                  <div>⚠️ {ch.raisedBy?.split(" ")[0]} challenged this: &ldquo;{ch.ch.reason}&rdquo;</div>
                  <div className="flex gap-2 mt-2">
                    <form action={resolveChallenge.bind(null, ch.ch.id, "dismissed")}><button className="btn btn-secondary btn-sm">It&apos;s legit</button></form>
                    <form action={resolveChallenge.bind(null, ch.ch.id, "upheld")}><button className="btn btn-danger btn-sm">Fair, remove it</button></form>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-3 text-center">
      <div className="text-xs text-muted">{label}</div>
      <div className="font-bold font-mono text-lg">{value}</div>
    </div>
  );
}
