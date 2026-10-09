import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * One-tap pairing for the Apple Pay shortcut.
 *
 * The settings page mints a short-lived signed token and puts it in a
 * `shortcuts://run-shortcut?…&input=text&text=<token>` link. Tapping it runs the shared
 * shortcut on the phone, which posts the token to /api/ingest/apple-pay/pair and gets a
 * fresh API key back to keep. The user never sees or pastes the key.
 *
 * Tokens are stateless: HMAC-SHA256 over { user, issued, expires } with AUTH_SECRET.
 * Single use is enforced by the pair endpoint, which rejects a token older than the key it
 * would replace.
 */

export const PAIR_TOKEN_PREFIX = "wcsl_pair_";
export const PAIR_TOKEN_TTL_MS = 15 * 60 * 1000;

interface PairPayload {
  u: string; // user id
  i: number; // issued at, ms
  e: number; // expires at, ms
}

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET must be set to mint Apple Pay connect links");
  return value;
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function mintPairToken(userId: string, now = Date.now()) {
  const payload: PairPayload = { u: userId, i: now, e: now + PAIR_TOKEN_TTL_MS };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${PAIR_TOKEN_PREFIX}${encoded}.${sign(encoded)}`;
}

export type PairTokenCheck = { ok: true; userId: string; issuedAt: Date } | { ok: false; reason: "malformed" | "bad_signature" | "expired" };

export function verifyPairToken(token: string, now = Date.now()): PairTokenCheck {
  const trimmed = token.trim();
  if (!trimmed.startsWith(PAIR_TOKEN_PREFIX)) return { ok: false, reason: "malformed" };
  const [encoded, signature, ...rest] = trimmed.slice(PAIR_TOKEN_PREFIX.length).split(".");
  if (!encoded || !signature || rest.length) return { ok: false, reason: "malformed" };

  const expected = Buffer.from(sign(encoded));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return { ok: false, reason: "bad_signature" };

  let payload: PairPayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (typeof payload.u !== "string" || typeof payload.i !== "number" || typeof payload.e !== "number") return { ok: false, reason: "malformed" };
  if (payload.e < now) return { ok: false, reason: "expired" };
  return { ok: true, userId: payload.u, issuedAt: new Date(payload.i) };
}
