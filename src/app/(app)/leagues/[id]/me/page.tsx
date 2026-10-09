import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import { badges, challenges, screenshots, transactions, users } from "@/db/schema";
import { EntryRow } from "@/components/EntryRow";
import { Icon } from "@/components/Icon";
import { LeagueHeader } from "@/components/LeagueHeader";
import { SectionHead } from "@/components/PageHeader";
import { categoryInfo } from "@/lib/categories";
import { currentPeriod, formatDay, formatPeriodShort, listDays, ordinal, todayIn } from "@/lib/dates";
import { requireMember } from "@/lib/league-access";
import { formatMoney } from "@/lib/money";
import { computeLeagueStats } from "@/lib/stats";

const BADGE_ICONS: Record<string, string> = {
  weekly_winner: "emoji_events",
  monthly_winner: "emoji_events",
  big_spender: "payments",
  perfect_logger: "event_available",
  no_takeaway: "no_meals",
  monk_mode: "self_improvement",
};

export default async function MePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, league } = await requireMember(id);
  const period = currentPeriod(league.window, league.timezone);
  const stats = await computeLeagueStats(league, period);
  const me = stats.members.find((m) => m.userId === user.id);
  const today = todayIn(league.timezone);

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
  const weekly = league.window === "weekly";
  const maxDay = Math.max(1, ...Object.values(me?.byDay ?? {}));
  const excluded = new Set(league.excludedCategories ?? []);

  return (
    <div className="rise flex flex-col">
      <LeagueHeader league={league} user={user} />

      <div className="eyebrow px-4 pt-5 pb-1">Your {weekly ? "week" : "month"} · {formatPeriodShort(period)}</div>
      <div className="grid grid-cols-3 border-b border-line px-4 pt-2 pb-5">
        <Stat value={formatMoney(me?.totalMinor ?? 0, league.currency)} label="spent" />
        <Stat value={me ? ordinal(me.rank) : "–"} label={`of ${stats.members.length}`} divided />
        <Stat value={`${me?.uploadDays ?? 0}/${stats.daysElapsed}`} label="days logged" divided />
      </div>
      {me && me.penaltyMinor > 0 && (
        <div className="px-4 pt-3 text-xs text-bad">
          Includes {formatMoney(me.penaltyMinor, league.currency)} in missed-day penalties ({me.missedDays} {me.missedDays === 1 ? "day" : "days"}).
        </div>
      )}
      {myBadges.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 pt-3.5">
          {myBadges.map((b) => (
            <span
              key={b.id}
              className="inline-flex h-7 items-center gap-1.5 rounded-full border border-line2 px-2.5 text-xs font-semibold text-ink2"
              title={`${formatDay(b.periodStart)} – ${formatDay(b.periodEnd)}`}
            >
              <Icon name={BADGE_ICONS[b.type] ?? "military_tech"} size={16} fill className="text-accent" />
              {b.label}
            </span>
          ))}
        </div>
      )}

      <SectionHead label="By category" className="pt-6" />
      <div className="flex flex-col gap-3 px-4">
        {cats.length === 0 && <p className="text-sm text-muted">No counted spending yet this {weekly ? "week" : "month"}.</p>}
        {cats.map(([cid, minor]) => {
          const c = categoryInfo(cid);
          return (
            <div key={cid}>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Icon name={c.icon} size={18} className="text-ink2" />
                  {c.label}
                </span>
                <span className="font-mono">{formatMoney(minor, league.currency)}</span>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-sm bg-line">
                <div className="h-full bg-accent" style={{ width: `${Math.round((minor / maxCat) * 100)}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <SectionHead label="By day" right={`Today is ${formatDay(today, { weekday: "short" })}`} />
      <div className={`flex h-[110px] items-end px-4 ${weekly ? "gap-1.5" : "gap-[2px]"}`}>
        {days.map((d, i) => {
          const v = me?.byDay[d] ?? 0;
          const color = d === today ? "bg-accent" : d > today ? "bg-line" : "bg-accent-soft";
          const showLabel = weekly || i % 7 === 0;
          return (
            <div key={d} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5" title={`${formatDay(d)}: ${formatMoney(v, league.currency)}`}>
              {weekly && <span className="font-mono text-[10px] text-muted">{v ? Math.round(v / 100) : ""}</span>}
              <div className={`w-full rounded-[3px] ${color}`} style={{ height: Math.max(3, Math.round((v / maxDay) * 72)) }} />
              <span className="h-[15px] text-[11px] text-muted">{showLabel ? (weekly ? formatDay(d, { weekday: "narrow" }) : formatDay(d, { day: "numeric" })) : ""}</span>
            </div>
          );
        })}
      </div>

      <SectionHead label="Your entries" right={`${mine.length} this ${weekly ? "week" : "month"}`} />
      {mine.length === 0 && <div className="border-t border-line px-4 py-4 text-sm text-muted">Nothing yet. Tap the camera to log something.</div>}
      {mine.map(({ tx, shotUrl }) => {
        const c = categoryInfo(tx.category);
        const meta = [
          formatDay(tx.occurredOn, { weekday: "short", day: "numeric", month: "short" }),
          c.label,
          excluded.has(tx.category) ? "not counted" : null,
          tx.currency !== league.currency ? formatMoney(tx.amountMinor, tx.currency) : null,
        ]
          .filter(Boolean)
          .join(" · ");
        return (
          <EntryRow
            key={tx.id}
            mode="mine"
            txId={tx.id}
            icon={c.icon}
            merchant={tx.merchant}
            meta={meta}
            amount={formatMoney(tx.amountLeagueMinor, league.currency)}
            shotUrl={shotUrl}
            challenges={myChallenges.filter((ch) => ch.ch.transactionId === tx.id).map((ch) => ({ id: ch.ch.id, by: (ch.raisedBy ?? "Someone").split(" ")[0], reason: ch.ch.reason }))}
          />
        );
      })}
      <div className="h-8" />
    </div>
  );
}

function Stat({ value, label, divided = false }: { value: string; label: string; divided?: boolean }) {
  return (
    <div className={divided ? "border-l border-line pl-3.5" : ""}>
      <div className="font-mono text-[26px] leading-[1.1] font-medium">{value}</div>
      <div className="mt-1 text-xs text-muted">{label}</div>
    </div>
  );
}
