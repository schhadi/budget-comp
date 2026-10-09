"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { rotateApiKey } from "@/lib/api-keys";
import { requireUser } from "@/lib/session";

export type KeyResult = { ok: true; key: string } | { ok: false; error: string };

function revalidate() {
  revalidatePath("/settings");
  revalidatePath("/settings/apple-pay");
}

/** Create (or replace) the signed-in user's Apple Pay shortcut key. The plaintext is returned exactly once. */
export async function createApplePayKey(): Promise<KeyResult> {
  const me = await requireUser();
  const key = await rotateApiKey(me.id, "Set up by hand");
  revalidate();
  return { ok: true, key };
}

export async function revokeApplePayKey(): Promise<void> {
  const me = await requireUser();
  await db.delete(apiKeys).where(eq(apiKeys.userId, me.id));
  revalidate();
}
