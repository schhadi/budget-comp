import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { apiKeys, users } from "@/db/schema";
import { rotateApiKey } from "@/lib/api-keys";
import { json, leaguesFor, readBody, str } from "@/lib/ingest";
import { verifyPairToken } from "@/lib/pairing";

/**
 * One-tap pairing. The settings page opens the shared shortcut with a signed, short-lived token as
 * its input; the shortcut posts it here with the phone's name and gets a fresh API key back, which
 * it saves on the phone. From then on it sends payments with that key.
 *
 *   POST /api/ingest/apple-pay/pair
 *   { "token": "wcsl_pair_…", "device": "Yusuf's iPhone" }
 *   → { ok: true, key: "wcs_…", message: "Connected as Yusuf …" }
 */

export const maxDuration = 30;

export async function POST(request: Request) {
  const body = await readBody(request);
  const token = str(body.token ?? body.text ?? body.input ?? body.key);
  const device = str(body.device ?? body.device_name ?? body.deviceName).slice(0, 60);
  if (!token) return json({ ok: false, error: "No connect token was sent. Open Settings → Apple Pay auto-log in the app and tap Connect this iPhone." }, 400);

  const check = verifyPairToken(token);
  if (!check.ok) {
    const error =
      check.reason === "expired"
        ? "This connect link has expired. Go back to the app, reload the page and tap Connect this iPhone again."
        : "This connect link isn't valid. Go back to the app and tap Connect this iPhone again.";
    return json({ ok: false, error }, 401);
  }

  const user = await db.query.users.findFirst({ where: eq(users.id, check.userId) });
  if (!user) return json({ ok: false, error: "That account no longer exists." }, 401);

  // A key created after this token was minted means the link was already used; don't let a replay rotate it again.
  const existing = await db.query.apiKeys.findFirst({ where: eq(apiKeys.userId, user.id) });
  if (existing && existing.createdAt.getTime() > check.issuedAt.getTime()) {
    return json({ ok: false, error: "This connect link was already used. If you want to reconnect, reload the page in the app and tap Connect again." }, 409);
  }

  const key = await rotateApiKey(user.id, device || "iPhone");
  revalidatePath("/settings");
  revalidatePath("/settings/apple-pay");

  const mine = await leaguesFor(user.id);
  const name = user.name?.split(" ")[0] ?? "you";
  return json({
    ok: true,
    key,
    user: user.name ?? user.email,
    device: device || null,
    leagues: mine.map((l) => ({ id: l.id, name: l.name, currency: l.currency })),
    message: mine.length
      ? `Connected as ${name}. Apple Pay taps will land on the Review tab of ${mine.length === 1 ? mine[0].name : `your ${mine.length} leagues`}.`
      : `Connected as ${name}. Join a league in the app and your Apple Pay taps will land on its Review tab.`,
  });
}

export async function GET() {
  return json({ ok: false, error: "POST a connect token here. Tap Connect this iPhone in Settings → Apple Pay auto-log to get one." }, 405);
}
