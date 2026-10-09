import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { leagues, memberships } from "@/db/schema";
import { parseMoneyText } from "@/lib/money";

/** Helpers shared by the Apple Pay ingest and pairing endpoints. */

export type Body = Record<string, unknown>;

export function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

/** Error reply. `message` mirrors `error` so the shortcut can show one field whether or not the call worked. */
export function fail(error: string, status: number) {
  return json({ ok: false, error, message: error }, status);
}

export function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
}

export function isObject(value: unknown): value is Body {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/**
 * Shortcuts can send JSON, a form, or plain text depending on how the action is set up. Accept all
 * three. Plain text that is neither JSON nor form-encoded comes back as a `text` field.
 */
export async function readBody(request: Request): Promise<Body> {
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
      // not JSON
    }
    if (/^[^=\n]+=[^\n]*(&[^=\n]+=[^\n]*)*$/.test(text.trim())) return { ...query, ...Object.fromEntries(new URLSearchParams(text).entries()) };
    return { ...query, text };
  } catch {
    return query;
  }
}

export async function leaguesFor(userId: string) {
  const rows = await db
    .select({ league: leagues })
    .from(memberships)
    .innerJoin(leagues, eq(leagues.id, memberships.leagueId))
    .where(eq(memberships.userId, userId));
  return rows.map((r) => r.league);
}

// ---------------- The Text payload sent by the shared shortcut ----------------

const CURRENCY_TOKEN = /[£€$¥₹₨₦₺₩]|\b[A-Z]{3}\b/g;
const INLINE_AMOUNT = /(?:[£€$¥₹₨₦₺₩]|\b[A-Z]{3}\b)\s?-?\d[\d.,]*|-?\d[\d.,]*\s?(?:[£€$¥₹₨₦₺₩]|\b[A-Z]{3}\b)|\b-?\d+[.,]\d{2}\b/;

/** True when a whole line is just an amount: "£4.50", "4,50 €", "GBP 12", "-3.20". */
export function looksLikeAmount(line: string) {
  const bare = line.replace(CURRENCY_TOKEN, "").replace(/[\s+-]/g, "");
  return /^\d[\d.,]*$/.test(bare) && parseMoneyText(line).amount !== null;
}

/**
 * The automation on the phone renders a Text action with the merchant, amount and card on three
 * lines and hands it to the shared shortcut, which forwards it verbatim. Pull the three back out.
 * Tolerates a missing card, a different line order, and everything on one line.
 */
export function parseShortcutText(text: string): { merchant: string; amount: string; card: string } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return { merchant: "", amount: "", card: "" };

  if (lines.length === 1) {
    const match = lines[0].match(INLINE_AMOUNT);
    if (!match || match.index === undefined) return { merchant: lines[0], amount: "", card: "" };
    return {
      merchant: lines[0].slice(0, match.index).replace(/[\s·|,-]+$/, "").trim(),
      amount: match[0].trim(),
      card: lines[0]
        .slice(match.index + match[0].length)
        .replace(/^[\s·|,-]+/, "")
        .trim(),
    };
  }

  // Merchant is meant to be first, so look for the amount after it before falling back to line 1.
  let amountIdx = lines.findIndex((l, i) => i > 0 && looksLikeAmount(l));
  if (amountIdx < 0 && looksLikeAmount(lines[0])) amountIdx = 0;
  const rest = lines.filter((_, i) => i !== amountIdx);
  return { merchant: rest[0] ?? "", amount: amountIdx >= 0 ? lines[amountIdx] : "", card: rest.slice(1).join(" · ") };
}
