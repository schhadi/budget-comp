import { and, eq, gt } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { leagues, memberships, transactions } from "@/db/schema";
import { extractApiKey, userForApiKey } from "@/lib/api-keys";
import { isCategory } from "@/lib/categories";
import { resolveMerchant } from "@/lib/categorise";
import { isoDateValid, todayIn } from "@/lib/dates";
import { appUrl } from "@/lib/env";
import { convertMinor } from "@/lib/fx";
import { formatMoney, normaliseCurrencyCode, parseMoneyText, toMinor } from "@/lib/money";

/**
 * Receives Apple Pay payments from an iPhone Shortcut (Automation → Transaction trigger)
 * and files them as PENDING entries in every league the key's owner is in. Nothing counts
 * until the person confirms it on the Review tab, same as a screenshot.
 *
 *   POST /api/ingest/apple-pay
 *   Authorization: Bearer wcs_…        (or a "key" field in the body)
 *   { "merchant": "TESCO STORES 3245", "amount": "£4.50", "card": "Monzo" }
 *
 * Optional fields: currency (ISO code), date (YYYY-MM-DD), category (id), league (id or name).
 * GET with the same key returns who the key belongs to, for testing the connection.
 */

export const maxDuration = 60;
const DUPLICATE_WINDOW_MS = 2 * 60 * 1000;

type Body = Record<string, unknown>;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
}

function isObject(value: unknown): value is Body {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** Shortcuts can send JSON, a form, or plain text depending on how the action is set up. Accept all three. */
async function readBody(request: Request): Promise<Body> {
  const query: Body = Object.fromEntries(new URL(request.url).searchParams.entries());
  const contentType = request.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      const parsed: unknown = await request.json();
      return { ...query, ...(isObject(parsed) ? parsed : {}) };
    }
    if (contentType.includes("form")) {
      const form = await request.formData();
      const fields: Body = {};
      for (const [k, v] of form.entries()) fields[k] = typeof v === "string" ? v : "";
      return { ...query, ...fields };
    }
    const text = await request.text();
    if (!text.trim()) return query;
    try {
      const parsed: unknown = JSON.parse(text);
      if (isObject(parsed)) return { ...query, ...parsed };
    } catch {
      // not JSON; fall through to form-encoded
    }
    return { ...query, ...Object.fromEntries(new URLSearchParams(text).entries()) };
  } catch {
    return query;
  }
}

async function leaguesFor(userId: string) {
  const rows = await db
    .select({ league: leagues })
    .from(memberships)
    .innerJoin(leagues, eq(leagues.id, memberships.leagueId))
    .where(eq(memberships.userId, userId));
  return rows.map((r) => r.league);
}

/** Connection test: who does this key belong to and where will entries go? */
export async function GET(request: Request) {
  const key = extractApiKey(request, {});
  if (!key) return json({ ok: false, error: "Missing API key. Send it as 'Authorization: Bearer <key>'." }, 401);
  const auth = await userForApiKey(key);
  if (!auth) return json({ ok: false, error: "That key isn't valid. Generate a new one in Settings → Apple Pay auto-log." }, 401);
  const mine = await leaguesFor(auth.user.id);
  return json({
    ok: true,
    user: auth.user.name ?? auth.user.email,
    leagues: mine.map((l) => ({ id: l.id, name: l.name, currency: l.currency })),
    message: `Connected as ${auth.user.name ?? "you"}. Payments will land in ${mine.length} league${mine.length === 1 ? "" : "s"}.`,
  });
}

export async function POST(request: Request) {
  const body = await readBody(request);
  const key = extractApiKey(request, body);
  if (!key) return json({ ok: false, error: "Missing API key. Send it as 'Authorization: Bearer <key>' or a 'key' field." }, 401);
  const auth = await userForApiKey(key);
  if (!auth) return json({ ok: false, error: "That key isn't valid. Generate a new one in Settings → Apple Pay auto-log." }, 401);
  const { user } = auth;

  const rawMerchant = str(body.merchant ?? body.name ?? body.store ?? body.payee);
  const card = str(body.card ?? body.card_or_pass ?? body.cardOrPass) || null;
  const money = parseMoneyText(body.amount ?? body.total ?? body.value);
  const explicitCurrency = normaliseCurrencyCode(body.currency);
  const requestedDate = str(body.date);
  const requestedCategory = str(body.category);
  const onlyLeague = str(body.league ?? body.league_id ?? body.leagueId);

  // Running the automation by hand sends nothing. Treat that as a connection test rather than logging a blank.
  if (!rawMerchant && money.amount === null) {
    return json({
      ok: true,
      created: 0,
      message: `Connected as ${user.name ?? "you"}. No merchant or amount was sent, so nothing was logged.`,
    });
  }

  let targets = await leaguesFor(user.id);
  if (onlyLeague) {
    const wanted = onlyLeague.toLowerCase();
    targets = targets.filter((l) => l.id === onlyLeague || l.name.toLowerCase() === wanted);
    if (!targets.length) return json({ ok: false, error: `You're not in a league called "${onlyLeague}".` }, 404);
  }
  if (!targets.length) return json({ ok: false, error: "You're not in any league yet. Join one in the app first." }, 409);

  const amount = money.amount ?? 0;
  const amountMissing = !(amount > 0);
  const resolved = await resolveMerchant(rawMerchant, card);
  const category = isCategory(requestedCategory) ? requestedCategory : resolved.category;
  const confidence = amountMissing ? 0 : isCategory(requestedCategory) ? 1 : resolved.confidence;

  const outcomes: { league: string; leagueId: string; status: "created" | "duplicate" }[] = [];
  let amountLabel = "";

  for (const league of targets) {
    const currency = explicitCurrency ?? money.currency ?? league.currency;
    const amountMinor = amountMissing ? 0 : toMinor(amount, currency);
    const today = todayIn(league.timezone);
    const occurredOn = requestedDate && isoDateValid(requestedDate) && requestedDate <= today ? requestedDate : today;
    amountLabel = amountMissing ? "" : formatMoney(amountMinor, currency);

    // Shortcuts occasionally fire twice for one tap. Skip an identical entry from the last couple of minutes.
    const duplicate = await db.query.transactions.findFirst({
      where: and(
        eq(transactions.leagueId, league.id),
        eq(transactions.userId, user.id),
        eq(transactions.source, "apple_pay"),
        eq(transactions.amountMinor, amountMinor),
        eq(transactions.currency, currency),
        eq(transactions.merchant, resolved.merchant),
        gt(transactions.createdAt, new Date(Date.now() - DUPLICATE_WINDOW_MS)),
      ),
    });
    if (duplicate) {
      outcomes.push({ league: league.name, leagueId: league.id, status: "duplicate" });
      continue;
    }

    const fx = amountMissing ? { minor: 0, rate: 1, converted: true } : await convertMinor(amountMinor, currency, league.currency, occurredOn);
    const notes = [
      `Apple Pay${card ? ` · ${card}` : ""}${rawMerchant && rawMerchant !== resolved.merchant ? ` · "${rawMerchant.slice(0, 60)}"` : ""}`,
      amountMissing ? "Apple Pay didn't send an amount. Check your bank app and fill it in." : null,
      resolved.via === "blank" ? "Apple Pay didn't send the merchant name." : null,
      fx.converted ? null : "FX rate unavailable, stored 1:1",
    ]
      .filter(Boolean)
      .join(" · ");

    await db.insert(transactions).values({
      leagueId: league.id,
      userId: user.id,
      amountMinor,
      currency,
      amountLeagueMinor: fx.minor,
      merchant: resolved.merchant,
      category,
      occurredOn,
      status: "pending",
      confidence,
      source: "apple_pay",
      notes,
    });
    outcomes.push({ league: league.name, leagueId: league.id, status: "created" });
    revalidatePath(`/leagues/${league.id}/review`);
    revalidatePath(`/leagues/${league.id}`);
  }
  revalidatePath("/dashboard");

  const created = outcomes.filter((o) => o.status === "created");
  const where = created.length > 1 ? ` in ${created.length} leagues` : "";
  const message = !created.length
    ? `Already logged ${amountLabel || "this"} at ${resolved.merchant} a moment ago.`
    : amountMissing
      ? `Logged ${resolved.merchant} with no amount${where}. Add the amount on the Review tab.`
      : `Logged ${amountLabel} at ${resolved.merchant}${where}. Confirm it on the Review tab.`;

  const reviewUrl = created.length === 1 ? `${appUrl()}/leagues/${created[0].leagueId}/review` : `${appUrl()}/dashboard`;
  return json({
    ok: true,
    created: created.length,
    duplicates: outcomes.length - created.length,
    merchant: resolved.merchant,
    amount: amountMissing ? null : amount,
    amount_label: amountLabel || null,
    category,
    leagues: outcomes,
    review_url: reviewUrl,
    message,
  });
}
