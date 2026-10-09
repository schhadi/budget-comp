import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { badges, memberships, recaps, users, type League, type RecapKind } from "@/db/schema";
import { generateRecapSlides, type RecapSlides } from "./anthropic";
import { formatPeriod, monthContaining, previousPeriod, weekContaining, type Period } from "./dates";
import { sendRecapEmail } from "./email";
import { formatMoney } from "./money";
import { computeLeagueStats, statsForRecap, type LeagueStats } from "./stats";

export interface RecapStatsPayload {
  input: ReturnType<typeof statsForRecap>;
  leaderboard: { userId: string; name: string; image: string | null; rank: number; totalMinor: number; spendMinor: number; penaltyMinor: number; txCount: number; uploadDays: number; noSpendDays: number; bestStreak: number }[];
  categoryTotals: Record<string, number>;
  groupSpendMinor: number;
}

export function recapPeriod(kind: RecapKind, anyDayIso: string): Period {
  return kind === "weekly" ? weekContaining(anyDayIso) : monthContaining(anyDayIso);
}

/** Creates (or returns the existing) recap for a league + period. Awards badges. Optionally emails members. */
export async function ensureRecap(league: League, kind: RecapKind, period: Period, opts: { email: boolean; force?: boolean }) {
  const existing = await db.query.recaps.findFirst({
    where: and(eq(recaps.leagueId, league.id), eq(recaps.kind, kind), eq(recaps.periodStart, period.start)),
  });
  if (existing && !opts.force) return { recap: existing, created: false };

  const stats = await computeLeagueStats(league, period);
  const prevPeriod = previousPeriod(kind, period);
  const previous = await computeLeagueStats(league, prevPeriod).catch(() => null);
  const input = statsForRecap(league, stats, previous);

  let slides: RecapSlides;
  try {
    slides = await generateRecapSlides(input);
  } catch (err) {
    console.error("[recap] AI generation failed, using fallback slides", err);
    slides = fallbackSlides(league, stats);
  }

  const payload: RecapStatsPayload = {
    input,
    leaderboard: stats.members.map((m) => ({
      userId: m.userId,
      name: m.name,
      image: m.image,
      rank: m.rank,
      totalMinor: m.totalMinor,
      spendMinor: m.spendMinor,
      penaltyMinor: m.penaltyMinor,
      txCount: m.txCount,
      uploadDays: m.uploadDays,
      noSpendDays: m.noSpendDays,
      bestStreak: m.bestStreak,
    })),
    categoryTotals: stats.categoryTotals,
    groupSpendMinor: stats.groupSpendMinor,
  };

  let recap;
  if (existing) {
    [recap] = await db.update(recaps).set({ stats: payload, slides }).where(eq(recaps.id, existing.id)).returning();
  } else {
    [recap] = await db
      .insert(recaps)
      .values({ leagueId: league.id, kind, periodStart: period.start, periodEnd: period.end, stats: payload, slides })
      .returning();
  }

  await awardBadges(league, stats, period);

  if (opts.email) {
    const members = await db
      .select({ email: users.email, name: users.name, recapEmails: users.recapEmails })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(eq(memberships.leagueId, league.id));
    const teaser = slides.league_slides[0]?.headline ?? "The numbers are in.";
    await Promise.allSettled(
      members
        .filter((m) => m.email && m.recapEmails)
        .map((m) =>
          sendRecapEmail(m.email!, (m.name ?? "friend").split(" ")[0], league, { id: recap.id, kind, periodLabel: formatPeriod(period) }, teaser),
        ),
    );
  }

  return { recap, created: !existing };
}

async function awardBadges(league: League, stats: LeagueStats, period: Period) {
  if (stats.members.length === 0) return;
  const rows: (typeof badges.$inferInsert)[] = [];
  const winner = stats.members[0];
  rows.push({ leagueId: league.id, userId: winner.userId, type: `${league.window}_winner`, label: "Spent the least", emoji: "🏆", periodStart: period.start, periodEnd: period.end });
  const loser = stats.members[stats.members.length - 1];
  if (stats.members.length > 1 && loser.totalMinor > winner.totalMinor) {
    rows.push({ leagueId: league.id, userId: loser.userId, type: "big_spender", label: "Big spender", emoji: "💸", periodStart: period.start, periodEnd: period.end });
  }
  const perfect = stats.members.filter((m) => m.missedDays === 0 && stats.daysElapsed >= 5);
  for (const m of perfect) rows.push({ leagueId: league.id, userId: m.userId, type: "perfect_logger", label: "Logged every day", emoji: "📸", periodStart: period.start, periodEnd: period.end });
  const noFoodOut = stats.members.filter((m) => m.txCount > 0 && !m.byCategory["food_out"]);
  for (const m of noFoodOut) rows.push({ leagueId: league.id, userId: m.userId, type: "no_takeaway", label: "No takeaways", emoji: "🥗", periodStart: period.start, periodEnd: period.end });
  const monk = stats.members.filter((m) => m.noSpendDays >= 3);
  for (const m of monk) rows.push({ leagueId: league.id, userId: m.userId, type: "monk_mode", label: `${m.noSpendDays} no-spend days`, emoji: "🧘", periodStart: period.start, periodEnd: period.end });
  if (rows.length) await db.insert(badges).values(rows).onConflictDoNothing();
}

function fallbackSlides(league: League, stats: LeagueStats): RecapSlides {
  const c = league.currency;
  const winner = stats.members[0];
  return {
    league_slides: [
      { title: "This period", headline: `${league.name} spent ${formatMoney(stats.groupSpendMinor, c)}`, body: "Between all of you. Impressive or concerning, you decide.", emoji: "💷" },
      ...(stats.topCategory ? [{ title: "Top category", headline: stats.topCategory.label, body: `${formatMoney(stats.topCategory.minor, c)} went here.`, emoji: "📊" }] : []),
      ...(stats.biggest ? [{ title: "Biggest purchase", headline: `${stats.biggest.name} at ${stats.biggest.merchant}`, body: `${formatMoney(stats.biggest.minor, c)} in one go.`, emoji: "🫣" }] : []),
      ...(winner ? [{ title: "The winner", headline: `${winner.firstName} spent the least`, body: `${formatMoney(winner.totalMinor, c)} total. Bow down.`, emoji: "🏆" }] : []),
    ],
    member_slides: stats.members.map((m) => ({
      user_id: m.userId,
      slides: [
        { title: "Your total", headline: formatMoney(m.totalMinor, c), body: `That put you #${m.rank} of ${stats.members.length}.`, emoji: "🧾" },
        ...(m.topCategory ? [{ title: "Your top category", headline: m.topCategory.label, body: `${formatMoney(m.topCategory.minor, c)} of your spending.`, emoji: "🎯" }] : []),
        { title: "Logging", headline: `${m.uploadDays} days logged`, body: m.noSpendDays ? `${m.noSpendDays} of them were no-spend days.` : "Consistency is everything.", emoji: "📅" },
      ],
    })),
  };
}
