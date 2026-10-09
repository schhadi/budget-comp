import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function currentUser() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const user = await db.query.users.findFirst({ where: eq(users.id, id) });
  return user ?? null;
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/");
  return user;
}
