"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { challenges, dayLogs, leagues, screenshots, transactions, users } from "@/db/schema";
import { isCategory } from "@/lib/categories";
import { isoDateValid, todayIn } from "@/lib/dates";
import { sendChallengeEmail } from "@/lib/email";
import { convertMinor } from "@/lib/fx";
import { requireMember } from "@/lib/league-access";
import { formatMoney, parseAmountInput, toMinor } from "@/lib/money";
import type { ActionResult } from "./friends";

async function logDay(leagueId: string, userId: string, day: string, kind: "spend" | "no_spend") {
  await db
    .insert(dayLogs)
    .values({ leagueId, userId, day, kind })
    .onConflictDoUpdate({ target: [dayLogs.leagueId, dayLogs.userId, dayLogs.day], set: { kind } });
}

function revalidateLeague(leagueId: string) {
  revalidatePath(`/leagues/${leagueId}`);
  revalidatePath(`/leagues/${leagueId}/review`);
  revalidatePath(`/leagues/${leagueId}/me`);
  revalidatePath("/dashboard");
}

/** Confirm a pending transaction, applying any edits from the review form. */
export async function confirmTransaction(txId: string, formData: FormData): Promise<ActionResult> {
  const tx = await db.query.transactions.findFirst({ where: eq(transactions.id, txId) });
  if (!tx) return { ok: false, error: "Entry not found." };
  const { user, league } = await requireMember(tx.leagueId);
  if (tx.userId !== user.id) return { ok: false, error: "You can only confirm your own entries." };

  const amount = parseAmountInput(String(formData.get("amount") ?? ""));
  const currency = String(formData.get("currency") ?? tx.currency).toUpperCase();
  const merchant = String(formData.get("merchant") ?? "").trim().slice(0, 80);
  const category = String(formData.get("category") ?? tx.category);
  const occurredOn = String(formData.get("occurredOn") ?? tx.occurredOn);
  if (amount === null) return { ok: false, error: "Enter a valid amount." };
  if (!merchant) return { ok: false, error: "Enter a merchant." };
  if (!isCategory(category)) return { ok: false, error: "Pick a category." };
  if (!isoDateValid(occurredOn)) return { ok: false, error: "Pick a valid date." };

  const amountMinor = toMinor(amount, currency);
  const fx = await convertMinor(amountMinor, currency, league.currency, occurredOn);

  await db
    .update(transactions)
    .set({
      amountMinor,
      currency,
      amountLeagueMinor: fx.minor,
      merchant,
      category,
      occurredOn,
      status: "confirmed",
      confirmedAt: new Date(),
      notes: fx.converted ? tx.notes : `${tx.notes ?? ""} (FX rate unavailable, stored 1:1)`.trim(),
    })
    .where(eq(transactions.id, txId));
  await logDay(league.id, user.id, occurredOn, "spend");
  revalidateLeague(league.id);
  return { ok: true };
}

export async function rejectTransaction(txId: string) {
  const tx = await db.query.transactions.findFirst({ where: eq(transactions.id, txId) });
  if (!tx) return;
  const { user } = await requireMember(tx.leagueId);
  if (tx.userId !== user.id) return;
  await db.update(transactions).set({ status: "rejected" }).where(eq(transactions.id, txId));
  revalidateLeague(tx.leagueId);
}

export async function deleteTransaction(txId: string) {
  const tx = await db.query.transactions.findFirst({ where: eq(transactions.id, txId) });
  if (!tx) return;
  const { user } = await requireMember(tx.leagueId);
  if (tx.userId !== user.id) return;
  await db.delete(transactions).where(eq(transactions.id, txId));
  revalidateLeague(tx.leagueId);
}

/** Manual entry without a screenshot (for cash, or when the AI can't read an image). */
export async function addManualTransaction(leagueId: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { user, league } = await requireMember(leagueId);
  const amount = parseAmountInput(String(formData.get("amount") ?? ""));
  const currency = String(formData.get("currency") ?? league.currency).toUpperCase();
  const merchant = String(formData.get("merchant") ?? "").trim().slice(0, 80);
  const category = String(formData.get("category") ?? "other");
  const occurredOn = String(formData.get("occurredOn") ?? todayIn(league.timezone));
  if (amount === null) return { ok: false, error: "Enter a valid amount." };
  if (!merchant) return { ok: false, error: "Enter a merchant." };
  if (!isCategory(category)) return { ok: false, error: "Pick a category." };
  if (!isoDateValid(occurredOn)) return { ok: false, error: "Pick a valid date." };

  const amountMinor = toMinor(amount, currency);
  const fx = await convertMinor(amountMinor, currency, league.currency, occurredOn);
  await db.insert(transactions).values({
    leagueId,
    userId: user.id,
    amountMinor,
    currency,
    amountLeagueMinor: fx.minor,
    merchant,
    category,
    occurredOn,
    status: "confirmed",
    confirmedAt: new Date(),
    notes: "Entered manually (no screenshot)",
  });
  await logDay(leagueId, user.id, occurredOn, "spend");
  revalidateLeague(leagueId);
  return { ok: true, message: `Added ${formatMoney(amountMinor, currency)} at ${merchant}.` };
}

export async function markNoSpendDay(leagueId: string, day?: string) {
  const { user, league } = await requireMember(leagueId);
  const d = day && isoDateValid(day) ? day : todayIn(league.timezone);
  await logDay(leagueId, user.id, d, "no_spend");
  revalidateLeague(leagueId);
}

export async function challengeTransaction(txId: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const tx = await db.query.transactions.findFirst({ where: eq(transactions.id, txId) });
  if (!tx) return { ok: false, error: "Entry not found." };
  const { user, league } = await requireMember(tx.leagueId);
  if (!league.allowChallenges) return { ok: false, error: "Challenges are off in this league." };
  if (tx.userId === user.id) return { ok: false, error: "You can't challenge yourself." };
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 300);
  if (!reason) return { ok: false, error: "Say why you're challenging it." };
  await db.insert(challenges).values({ transactionId: txId, raisedById: user.id, reason });
  const owner = await db.query.users.findFirst({ where: eq(users.id, tx.userId) });
  if (owner?.email) {
    await sendChallengeEmail(owner.email, user.name ?? "A league mate", league, { merchant: tx.merchant, amountLabel: formatMoney(tx.amountLeagueMinor, league.currency) }, reason);
  }
  revalidateLeague(tx.leagueId);
  return { ok: true, message: "Challenge sent." };
}

export async function resolveChallenge(challengeId: string, resolution: "upheld" | "dismissed") {
  const ch = await db.query.challenges.findFirst({ where: eq(challenges.id, challengeId) });
  if (!ch) return;
  const tx = await db.query.transactions.findFirst({ where: eq(transactions.id, ch.transactionId) });
  if (!tx) return;
  const { user, league } = await requireMember(tx.leagueId);
  // The entry owner or the league owner can resolve.
  if (tx.userId !== user.id && league.ownerId !== user.id) return;
  await db.update(challenges).set({ resolution }).where(eq(challenges.id, challengeId));
  if (resolution === "upheld") {
    await db.update(transactions).set({ status: "rejected" }).where(eq(transactions.id, tx.id));
  }
  revalidateLeague(tx.leagueId);
}

/** Called by the upload page after a screenshot has been stored in Blob. */
export async function registerScreenshot(leagueId: string, blob: { url: string; pathname: string; contentType: string }) {
  const { user } = await requireMember(leagueId);
  const [row] = await db
    .insert(screenshots)
    .values({ leagueId, userId: user.id, blobUrl: blob.url, blobPathname: blob.pathname, contentType: blob.contentType })
    .returning();
  return row.id;
}

export async function deleteScreenshot(screenshotId: string) {
  const shot = await db.query.screenshots.findFirst({ where: eq(screenshots.id, screenshotId) });
  if (!shot) return;
  const { user } = await requireMember(shot.leagueId);
  if (shot.userId !== user.id) return;
  await db.delete(screenshots).where(and(eq(screenshots.id, screenshotId), eq(screenshots.userId, user.id)));
  try {
    const { del } = await import("@vercel/blob");
    await del(shot.blobUrl);
  } catch (err) {
    console.warn("[blob] delete failed", err);
  }
  revalidateLeague(shot.leagueId);
}

export async function leagueCurrencyOf(leagueId: string) {
  const league = await db.query.leagues.findFirst({ where: eq(leagues.id, leagueId) });
  return league?.currency ?? "GBP";
}
