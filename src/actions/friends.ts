"use server";

import { and, eq, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { friendships, users } from "@/db/schema";
import { sendFriendRequestEmail } from "@/lib/email";
import { requireUser } from "@/lib/session";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

export async function sendFriendRequest(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const me = await requireUser();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) return { ok: false, error: "Enter a valid email address." };
  if (email === me.email?.toLowerCase()) return { ok: false, error: "That's you." };

  const target = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!target) {
    return { ok: false, error: "No one with that email has signed in yet. Ask them to sign in with Google first, then add them." };
  }

  const existing = await db.query.friendships.findFirst({
    where: or(
      and(eq(friendships.requesterId, me.id), eq(friendships.addresseeId, target.id)),
      and(eq(friendships.requesterId, target.id), eq(friendships.addresseeId, me.id)),
    ),
  });
  if (existing) {
    if (existing.status === "accepted") return { ok: false, error: "You're already friends." };
    if (existing.requesterId === target.id) {
      await db.update(friendships).set({ status: "accepted" }).where(eq(friendships.id, existing.id));
      revalidatePath("/friends");
      return { ok: true, message: `They had already asked you. You're now friends with ${target.name ?? email}.` };
    }
    return { ok: false, error: "Request already sent. Waiting for them to accept." };
  }

  await db.insert(friendships).values({ requesterId: me.id, addresseeId: target.id });
  if (target.email) await sendFriendRequestEmail(target.email, me.name ?? "A friend");
  revalidatePath("/friends");
  return { ok: true, message: `Request sent to ${target.name ?? email}.` };
}

export async function respondToFriendRequest(friendshipId: string, accept: boolean) {
  const me = await requireUser();
  const row = await db.query.friendships.findFirst({ where: eq(friendships.id, friendshipId) });
  if (!row || row.addresseeId !== me.id) return;
  if (accept) {
    await db.update(friendships).set({ status: "accepted" }).where(eq(friendships.id, friendshipId));
  } else {
    await db.delete(friendships).where(eq(friendships.id, friendshipId));
  }
  revalidatePath("/friends");
}

export async function removeFriend(friendshipId: string) {
  const me = await requireUser();
  const row = await db.query.friendships.findFirst({ where: eq(friendships.id, friendshipId) });
  if (!row || (row.addresseeId !== me.id && row.requesterId !== me.id)) return;
  await db.delete(friendships).where(eq(friendships.id, friendshipId));
  revalidatePath("/friends");
}

export async function listFriends(userId: string) {
  const rows = await db
    .select()
    .from(friendships)
    .where(and(eq(friendships.status, "accepted"), or(eq(friendships.requesterId, userId), eq(friendships.addresseeId, userId))));
  const ids = rows.map((r) => (r.requesterId === userId ? r.addresseeId : r.requesterId));
  if (ids.length === 0) return [];
  const people = await db.query.users.findMany({ where: (u, { inArray }) => inArray(u.id, ids) });
  return rows.map((r) => {
    const otherId = r.requesterId === userId ? r.addresseeId : r.requesterId;
    const person = people.find((p) => p.id === otherId)!;
    return { friendshipId: r.id, user: person };
  });
}
