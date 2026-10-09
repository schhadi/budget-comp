import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import { dayLogs, memberships, transactions, users, type League } from "@/db/schema";
import { categoryInfo } from "./categories";
import { listDays, todayIn, type Period } from "./dates";
import { formatMoney } from "./money";

export interface MemberStats {
  userId: string;
  name: string;
  firstName: string;
  image: string | null;
  spendMinor: number; // counted spend (excluded categories removed)
  rawSpendMinor: number; // everything confirmed
  penaltyMinor: number;
  totalMinor: number; // spend + penalty, what the leaderboard ranks on
  txCount: number;
  uploadDays: number;
  noSpendDays: number;
  missedDays: number;
  currentStreak: number;
  bestStreak: number;
  topCategory: { id: string; label: string; minor: number } | null;
  topMerchant: { name: string; minor: number; count: number } | null;
  biggest: { merchant: string; minor: number; date: string; category: string } | null;
  byCategory: Record<string, number>;
  byDay: Record<string, number>;
  pendingCount: number;
  loggedToday: boolean;
  rank: number;
}

export interface LeagueStats {
  period: Period;
  daysElapsed: number;
  daysTotal: number;
  members: MemberStats[]; // sorted by totalMinor ascending (rank 1 first)
  groupSpendMinor: number;
  biggest: { userId: string; name: string; merchant: string; minor: number; date: string } | null;
  topMerchant: { name: string; minor: number; count: number } | null;
  topCategory: { id: string; label: string; minor: number } | null;
  categoryTotals: Record<string, number>;
}

function firstName(name: string | null | undefined, email?: string | null) {
  const n = (name ?? "").trim() || (email ?? "").split("@")[0] || "Someone";
  return n.split(/\s+/)[0];
}

export async function computeLeagueStats(league: League, period: Period): Promise<LeagueStats> {
  const today = todayIn(league.timezone);
  const days = listDays(period);
  // Only count days that have already happened (and today) for penalties/streaks.
  const elapsedDays = days.filter((d) => d <= today);
  const excluded = new Set(league.excludedCategories ?? []);

  const members = await db
    .select({ userId: memberships.userId, name: users.name, email: users.email, image: users.image })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.leagueId, league.id));

  const memberIds = members.map((m) => m.userId);
  if (memberIds.length === 0) {
    return {
      period,
      daysElapsed: elapsedDays.length,
      daysTotal: days.length,
      members: [],
      groupSpendMinor: 0,
      biggest: null,
      topMerchant: null,
      topCategory: null,
      categoryTotals: {},
    };
  }

  const txs = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.leagueId, league.id),
        inArray(transactions.userId, memberIds),
        gte(transactions.occurredOn, period.start),
        lte(transactions.occurredOn, period.end),
      ),
    );

  const logs = await db
    .select()
    .from(dayLogs)
    .where(
      and(
        eq(dayLogs.leagueId, league.id),
        inArray(dayLogs.userId, memberIds),
        gte(dayLogs.day, period.start),
        lte(dayLogs.day, period.end),
      ),
    );

  const merchantTotals = new Map<string, { minor: number; count: number }>();
  const categoryTotals: Record<string, number> = {};
  let groupSpend = 0;
  let biggest: LeagueStats["biggest"] = null;

  const statsByUser: MemberStats[] = members.map((m) => {
    const mine = txs.filter((t) => t.userId === m.userId);
    const confirmed = mine.filter((t) => t.status === "confirmed");
    const counted = confirmed.filter((t) => !excluded.has(t.category));
    const myLogs = logs.filter((l) => l.userId === m.userId);
    const loggedDays = new Set(myLogs.map((l) => l.day));
    // A confirmed transaction dated on a day also counts as logging that day.
    for (const t of confirmed) loggedDays.add(t.occurredOn);

    const byCategory: Record<string, number> = {};
    const byDay: Record<string, number> = {};
    const myMerchants = new Map<string, { minor: number; count: number }>();
    let myBiggest: MemberStats["biggest"] = null;

    for (const t of counted) {
      byCategory[t.category] = (byCategory[t.category] ?? 0) + t.amountLeagueMinor;
      byDay[t.occurredOn] = (byDay[t.occurredOn] ?? 0) + t.amountLeagueMinor;
      const key = t.merchant.trim().toLowerCase();
      const cur = myMerchants.get(key) ?? { minor: 0, count: 0 };
      myMerchants.set(key, { minor: cur.minor + t.amountLeagueMinor, count: cur.count + 1 });
      const gcur = merchantTotals.get(key) ?? { minor: 0, count: 0 };
      merchantTotals.set(key, { minor: gcur.minor + t.amountLeagueMinor, count: gcur.count + 1 });
      categoryTotals[t.category] = (categoryTotals[t.category] ?? 0) + t.amountLeagueMinor;
      if (!myBiggest || t.amountLeagueMinor > myBiggest.minor) {
        myBiggest = { merchant: t.merchant, minor: t.amountLeagueMinor, date: t.occurredOn, category: t.category };
      }
      if (!biggest || t.amountLeagueMinor > biggest.minor) {
        biggest = { userId: m.userId, name: firstName(m.name, m.email), merchant: t.merchant, minor: t.amountLeagueMinor, date: t.occurredOn };
      }
    }

    const spendMinor = counted.reduce((s, t) => s + t.amountLeagueMinor, 0);
    const rawSpendMinor = confirmed.reduce((s, t) => s + t.amountLeagueMinor, 0);
    groupSpend += spendMinor;

    const noSpendDays = myLogs.filter((l) => l.kind === "no_spend").length;
    const uploadDays = elapsedDays.filter((d) => loggedDays.has(d)).length;
    const missedDays = league.dailyUploadRequired ? elapsedDays.filter((d) => !loggedDays.has(d)).length : 0;
    const penaltyMinor = missedDays * league.missedDayPenaltyMinor;

    // Streaks over elapsed days (days with any log).
    let currentStreak = 0;
    let bestStreak = 0;
    let run = 0;
    for (const d of elapsedDays) {
      if (loggedDays.has(d)) {
        run += 1;
        bestStreak = Math.max(bestStreak, run);
      } else {
        run = 0;
      }
    }
    currentStreak = run;

    const topCat = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];
    const topMer = [...myMerchants.entries()].sort((a, b) => b[1].minor - a[1].minor)[0];
    const topMerchantName = topMer ? counted.find((t) => t.merchant.trim().toLowerCase() === topMer[0])?.merchant ?? topMer[0] : null;

    return {
      userId: m.userId,
      name: m.name ?? firstName(null, m.email),
      firstName: firstName(m.name, m.email),
      image: m.image ?? null,
      spendMinor,
      rawSpendMinor,
      penaltyMinor,
      totalMinor: spendMinor + penaltyMinor,
      txCount: counted.length,
      uploadDays,
      noSpendDays,
      missedDays,
      currentStreak,
      bestStreak,
      topCategory: topCat ? { id: topCat[0], label: categoryInfo(topCat[0]).label, minor: topCat[1] } : null,
      topMerchant: topMer && topMerchantName ? { name: topMerchantName, minor: topMer[1].minor, count: topMer[1].count } : null,
      biggest: myBiggest,
      byCategory,
      byDay,
      pendingCount: mine.filter((t) => t.status === "pending").length,
      loggedToday: loggedDays.has(today),
      rank: 0,
    };
  });

  statsByUser.sort((a, b) => a.totalMinor - b.totalMinor || b.uploadDays - a.uploadDays || a.name.localeCompare(b.name));
  statsByUser.forEach((s, i) => {
    s.rank = i > 0 && statsByUser[i - 1].totalMinor === s.totalMinor ? statsByUser[i - 1].rank : i + 1;
  });

  const topMerchantEntry = [...merchantTotals.entries()].sort((a, b) => b[1].minor - a[1].minor)[0];
  const topMerchantName = topMerchantEntry
    ? txs.find((t) => t.merchant.trim().toLowerCase() === topMerchantEntry[0])?.merchant ?? topMerchantEntry[0]
    : null;
  const topCategoryEntry = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];

  return {
    period,
    daysElapsed: elapsedDays.length,
    daysTotal: days.length,
    members: statsByUser,
    groupSpendMinor: groupSpend,
    biggest,
    topMerchant: topMerchantEntry && topMerchantName ? { name: topMerchantName, ...topMerchantEntry[1] } : null,
    topCategory: topCategoryEntry ? { id: topCategoryEntry[0], label: categoryInfo(topCategoryEntry[0]).label, minor: topCategoryEntry[1] } : null,
    categoryTotals,
  };
}

/** Compact, pre-formatted version of the stats for the recap writer. */
export function statsForRecap(league: League, stats: LeagueStats, previous: LeagueStats | null) {
  const c = league.currency;
  const money = (m: number) => formatMoney(m, c);
  const prevByUser = new Map((previous?.members ?? []).map((m) => [m.userId, m]));
  return {
    league: { name: league.name, currency: c, window: league.window, stake: league.stake, excludedCategories: league.excludedCategories },
    period: stats.period,
    days_in_period: stats.daysTotal,
    group_total: money(stats.groupSpendMinor),
    group_top_category: stats.topCategory ? { category: stats.topCategory.label, total: money(stats.topCategory.minor) } : null,
    group_top_merchant: stats.topMerchant ? { merchant: stats.topMerchant.name, total: money(stats.topMerchant.minor), times: stats.topMerchant.count } : null,
    biggest_single_purchase: stats.biggest ? { who: stats.biggest.name, merchant: stats.biggest.merchant, amount: money(stats.biggest.minor), date: stats.biggest.date } : null,
    winner: stats.members[0] ? { user_id: stats.members[0].userId, name: stats.members[0].firstName, total: money(stats.members[0].totalMinor) } : null,
    members: stats.members.map((m) => {
      const prev = prevByUser.get(m.userId);
      return {
        user_id: m.userId,
        name: m.firstName,
        rank: m.rank,
        total: money(m.totalMinor),
        spend_only: money(m.spendMinor),
        penalty: m.penaltyMinor ? money(m.penaltyMinor) : null,
        transactions: m.txCount,
        days_logged: m.uploadDays,
        no_spend_days: m.noSpendDays,
        missed_days: m.missedDays,
        best_streak_days: m.bestStreak,
        top_category: m.topCategory ? { category: m.topCategory.label, total: money(m.topCategory.minor) } : null,
        top_merchant: m.topMerchant ? { merchant: m.topMerchant.name, total: money(m.topMerchant.minor), times: m.topMerchant.count } : null,
        biggest_purchase: m.biggest ? { merchant: m.biggest.merchant, amount: money(m.biggest.minor), date: m.biggest.date } : null,
        previous_period: prev ? { rank: prev.rank, total: money(prev.totalMinor) } : null,
        change_vs_previous: prev ? money(m.totalMinor - prev.totalMinor) : null,
      };
    }),
  };
}
