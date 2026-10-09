import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys, users } from "@/db/schema";

export const API_KEY_PREFIX = "wcs_";

/** 192 bits of randomness, URL-safe so it survives being pasted into a Shortcut. */
export function generateApiKey() {
  return `${API_KEY_PREFIX}${randomBytes(24).toString("base64url")}`;
}

export function hashApiKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

export function apiKeyHint(key: string) {
  return key.slice(-4);
}

/**
 * Pull the key out of an incoming request. Accepted, in order:
 * `Authorization: Bearer <key>`, an `X-Api-Key` header, or a `key` field in the body.
 */
export function extractApiKey(request: Request, body: Record<string, unknown>): string | null {
  const auth = request.headers.get("authorization") ?? "";
  const bearer = auth.match(/^\s*Bearer\s+(\S+)\s*$/i)?.[1];
  const header = request.headers.get("x-api-key");
  const field = body.key ?? body.api_key ?? body.apiKey ?? body.token;
  const candidate = bearer || header || (typeof field === "string" ? field : null);
  const key = candidate?.replace(/^Bearer\s+/i, "").trim();
  return key ? key : null;
}

/** Resolve a key to its user, stamping last_used_at. Returns null for unknown keys. */
export async function userForApiKey(key: string) {
  const row = await db.query.apiKeys.findFirst({ where: eq(apiKeys.keyHash, hashApiKey(key)) });
  if (!row) return null;
  const user = await db.query.users.findFirst({ where: eq(users.id, row.userId) });
  if (!user) return null;
  await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, row.id));
  return { user, apiKey: row };
}
