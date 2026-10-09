"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { leagues, memberships, users, type LeagueWindow } from "@/db/schema";
import { CATEGORY_IDS, isCategory } from "@/lib/categories";
import { sendLeagueInviteEmail } from "@/lib/email";
import { generateInviteCode } from "@/lib/invite";
import { requireMember, requireOwner } from "@/lib/league-access";
import { CURRENCIES, toMinor } from "@/lib/money";
import { requireUser } from "@/lib/session";
import { listFriends, type ActionResult } from "./friends";

const TIMEZONES = ["Europe/London", "Europe/Dublin", "Europe/Paris", "Europe/Berlin", "Europe/Madrid", "Europe/Rome", "Europe/Amsterdam", "Europe/Istanbul", "Asia/Dubai", "Asia/Karachi", "Asia/Kolkata", "Asia/Singapore", "Asia/Hong_Kong", "Asia/Tokyo", "Asia/Seoul", "Australia/Sydney", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Toronto", "Africa/Lagos", "Africa/Johannesburg"];
export async function timezoneOptions() {
  return TIMEZONES;
}

type SettingsValues = {
  name: string;
  emoji: string;
  currency: string;
  timezone: string;
  window: LeagueWindow;
  excludedCategories: string[];
  dailyUploadRequired: boolean;
  missedDayPenaltyMinor: number;
  budgetTargetMinor: number | null;
  stake: string | null;
  allowChallenges: boolean;
  weeklyRecap: boolean;
  monthlyRecap: boolean;
};

function parseSettings(formData: FormData): { error: string; values?: undefined } | { error?: undefined; values: SettingsValues } {
  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  const emoji = String(formData.get("emoji") ?? "🏆").trim().slice(0, 4) || "🏆";
  const currency = String(formData.get("currency") ?? "GBP");
  const timezone = String(formData.get("timezone") ?? "Europe/London");
  const window = String(formData.get("window") ?? "weekly") as LeagueWindow;
  const excludedCategories = CATEGORY_IDS.filter((c) => formData.get(`exclude_${c}`) === "on");
  const dailyUploadRequired = formData.get("dailyUploadRequired") === "on";
  const penaltyRaw = Number(formData.get("missedDayPenalty") ?? 0);
  const budgetRaw = String(formData.get("budgetTarget") ?? "").trim();
  const stake = String(formData.get("stake") ?? "").trim().slice(0, 140) || null;
  const allowChallenges = formData.get("allowChallenges") === "on";
  const weeklyRecap = formData.get("weeklyRecap") === "on";
  const monthlyRecap = formData.get("monthlyRecap") === "on";

  if (!name) return { error: "Give the league a name." };
  if (!(CURRENCIES as readonly string[]).includes(currency)) return { error: "Pick a currency from the list." };
  if (!TIMEZONES.includes(timezone)) return { error: "Pick a timezone from the list." };
  if (window !== "weekly" && window !== "monthly") return { error: "Window must be weekly or monthly." };
  if (!Number.isFinite(penaltyRaw) || penaltyRaw < 0 || penaltyRaw > 1000) return { error: "Missed-day penalty must be between 0 and 1000." };
  const budgetTargetMinor = budgetRaw ? toMinor(Number(budgetRaw), currency) : null;
  if (budgetRaw && (!Number.isFinite(budgetTargetMinor!) || budgetTargetMinor! < 0)) return { error: "Budget target must be a number." };
  if (!excludedCategories.every(isCategory)) return { error: "Bad category." };

  return {
    values: {
      name,
      emoji,
      currency,
      timezone,
      window,
      excludedCategories,
      dailyUploadRequired,
      missedDayPenaltyMinor: toMinor(penaltyRaw, currency),
      budgetTargetMinor,
      stake,
      allowChallenges,
      weeklyRecap,
      monthlyRecap,
    },
  };
}

export async function createLeague(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const me = await requireUser();
  const parsed = parseSettings(formData);
  if (parsed.error !== undefined) return { ok: false, error: parsed.error };

  let league;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      [league] = await db
        .insert(leagues)
        .values({ ...parsed.values, ownerId: me.id, inviteCode: generateInviteCode() })
        .returning();
      break;
    } catch (err) {
      if (attempt === 4) throw err;
    }
  }
  if (!league) return { ok: false, error: "Could not create league." };
  await db.insert(memberships).values({ leagueId: league.id, userId: me.id, role: "owner" });

  // Add selected friends straight away.
  const friends = await listFriends(me.id);
  const selected = friends.filter((f) => formData.get(`friend_${f.user.id}`) === "on");
  if (selected.length) {
    await db.insert(memberships).values(selected.map((f) => ({ leagueId: league!.id, userId: f.user.id }))).onConflictDoNothing();
    await Promise.allSettled(selected.filter((f) => f.user.email).map((f) => sendLeagueInviteEmail(f.user.email!, me.name ?? "A friend", league!)));
  }

  redirect(`/leagues/${league.id}`);
}

export async function updateLeagueSettings(leagueId: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireOwner(leagueId);
  const parsed = parseSettings(formData);
  if (parsed.error !== undefined) return { ok: false, error: parsed.error };
  await db.update(leagues).set(parsed.values).where(eq(leagues.id, leagueId));
  revalidatePath(`/leagues/${leagueId}`);
  revalidatePath(`/leagues/${leagueId}/settings`);
  return { ok: true, message: "Settings saved." };
}

export async function regenerateInviteCode(leagueId: string) {
  await requireOwner(leagueId);
  await db.update(leagues).set({ inviteCode: generateInviteCode() }).where(eq(leagues.id, leagueId));
  revalidatePath(`/leagues/${leagueId}/members`);
}

export async function addFriendsToLeague(leagueId: string, formData: FormData): Promise<void> {
  const { user: me, league } = await requireMember(leagueId);
  const friends = await listFriends(me.id);
  const selected = friends.filter((f) => formData.get(`friend_${f.user.id}`) === "on");
  if (selected.length === 0) return;
  await db.insert(memberships).values(selected.map((f) => ({ leagueId, userId: f.user.id }))).onConflictDoNothing();
  await Promise.allSettled(selected.filter((f) => f.user.email).map((f) => sendLeagueInviteEmail(f.user.email!, me.name ?? "A friend", league)));
  revalidatePath(`/leagues/${leagueId}/members`);
  revalidatePath(`/leagues/${leagueId}`);
}

export async function joinByCode(code: string): Promise<ActionResult> {
  const me = await requireUser();
  const league = await db.query.leagues.findFirst({ where: eq(leagues.inviteCode, code.trim().toUpperCase()) });
  if (!league) return { ok: false, error: "That invite code doesn't exist." };
  await db.insert(memberships).values({ leagueId: league.id, userId: me.id }).onConflictDoNothing();
  redirect(`/leagues/${league.id}`);
}

export async function joinByCodeForm(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return joinByCode(String(formData.get("code") ?? ""));
}

export async function removeMember(leagueId: string, userId: string) {
  const { user: me, league } = await requireMember(leagueId);
  const isOwner = league.ownerId === me.id;
  if (!isOwner && userId !== me.id) return;
  if (userId === league.ownerId) return; // owner can't be removed; delete the league instead
  await db.delete(memberships).where(and(eq(memberships.leagueId, leagueId), eq(memberships.userId, userId)));
  revalidatePath(`/leagues/${leagueId}/members`);
  if (userId === me.id) redirect("/dashboard");
}

export async function deleteLeague(leagueId: string) {
  await requireOwner(leagueId);
  await db.delete(leagues).where(eq(leagues.id, leagueId));
  redirect("/dashboard");
}

export async function updateNotificationPrefs(formData: FormData) {
  const me = await requireUser();
  await db
    .update(users)
    .set({ reminderEmails: formData.get("reminderEmails") === "on", recapEmails: formData.get("recapEmails") === "on" })
    .where(eq(users.id, me.id));
  revalidatePath("/settings");
}
