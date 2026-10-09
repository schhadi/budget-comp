import { and, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import { leagues, memberships } from "@/db/schema";
import { requireUser } from "./session";

export async function requireMember(leagueId: string) {
  const user = await requireUser();
  const league = await db.query.leagues.findFirst({ where: eq(leagues.id, leagueId) });
  if (!league) notFound();
  const membership = await db.query.memberships.findFirst({
    where: and(eq(memberships.leagueId, leagueId), eq(memberships.userId, user.id)),
  });
  if (!membership) redirect("/dashboard?error=not-a-member");
  return { user, league, membership };
}

export async function requireOwner(leagueId: string) {
  const ctx = await requireMember(leagueId);
  if (ctx.membership.role !== "owner") redirect(`/leagues/${leagueId}?error=owner-only`);
  return ctx;
}
