import { and, eq, gt } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { transactions } from "@/db/schema";
import { extractApiKey, userForApiKey } from "@/lib/api-keys";
import { isCategory } from "@/lib/categories";
import { resolveMerchant } from "@/lib/categorise";
import { isoDateValid, todayIn } from "@/lib/dates";
import { appUrl } from "@/lib/env";
import { convertMinor } from "@/lib/fx";
import { isObject, json, leaguesFor, parseShortcutText, readBody, str } from "@/lib/ingest";
import { formatMoney, normaliseCurrencyCode, parseMoneyText, toMinor } from "@/lib/money";
import { PAIR_TOKEN_PREFIX } from "@/lib/pairing";

/**
 * Receives Apple Pay payments from an iPhone Shortcut (Automation → Wallet/Transaction trigger)
 * and files them as PENDING entries in every league the key's owner is in. Nothing counts
 * until the person confirms it on the Review tab, same as a screenshot.
 *
 *   POST /api/ingest/apple-pay
 *   Authorization: Bearer wcs_…        (or a "key" field in the body)
 *   { "merchant": "TESCO STORES 3245", "amount": "£4.50", "card": "Monzo" }
 *
 * The shared shortcut sends the automation's Text action instead, merchant, amount and card on
 * three lines: { "text": "TESCO STORES 3245\n£4.50\nMonzo" }. Both forms are accepted; explicit
 * fields win over the text when both are present.
 *
 * Optional fields: currency (ISO code), date (YYYY-MM-DD), category (id), league (id or name).
 * GET with the same key returns who the key belongs to, for testing the connection.
 */

export const maxDuration = 60;
const DUPLICATE_WINDOW_MS = 2 * 60 * 1000;

/** Connection test: who does this key belong to and where will entries go? */
export async function GET(request: Request) {
  const key = extractApiKey(request, {});
  if (!key) return json({ ok: false, error: "Missing API key. Send it as 'Authorization: Bearer <key>'." }, 401);
  const auth = await userForApiKey(key);
  if (!auth) return json({ ok: false, error: "That key isn't valid. Reconnect in Settings → Apple Pay auto-log." }, 401);
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
  const textPayload = str(body.text ?? body.payload ?? body.input);
  if (textPayload.startsWith(PAIR_TOKEN_PREFIX)) {
    return json({ ok: false, error: "That's a connect link, not a payment. The shortcut should send it to /api/ingest/apple-pay/pair." }, 400);
  }

  const key = extractApiKey(request, body);
  if (!key) return json({ ok: false, error: "Missing API key. Send it as 'Authorization: Bearer <key>' or a 'key' field." }, 401);
  const auth = await userForApiKey(key);
  if (!auth) return json({ ok: false, error: "That key isn't valid. Reconnect in Settings → Apple Pay auto-log." }, 401);
  const { user } = auth;

  const fromText = textPayload ? parseShortcutText(textPayload) : null;
  const rawMerchant = str(body.merchant ?? body.name ?? body.store ?? body.payee) || fromText?.merchant || "";
  const card = str(body.card ?? body.card_or_pass ?? body.cardOrPass) || fromText?.card || null;
  const explicitAmount = body.amount ?? body.total ?? body.value;
  const hasExplicitAmount = typeof explicitAmount === "number" || str(explicitAmount) !== "" || isObject(explicitAmount);
  const money = parseMoneyText(hasExplicitAmount ? explicitAmount : fromText?.amount);
  const explicitCurrency = normaliseCurrencyCode(body.currency);
  const requestedDate = str(body.date);
  const requestedCategory = str(body.category);
  const onlyLeague = str(body.league ?? body.league_id ?? body.leagueId);

  // Running the shortcut by hand sends nothing. Treat that as a connection test rather than logging a blank.
  if (!rawMerchant && money.amount === null) {
    return json({
      ok: true,
      created: 0,
      message: `Connected as ${user.name?.split(" ")[0] ?? "you"}. No merchant or amount was sent, so nothing was logged.`,
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
