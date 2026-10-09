import { eq } from "drizzle-orm";
import { ApplePaySetup } from "@/components/ApplePaySetup";
import { PageHeader } from "@/components/PageHeader";
import { db } from "@/db";
import { apiKeys, leagues, memberships } from "@/db/schema";
import { appUrl } from "@/lib/env";
import { requireUser } from "@/lib/session";

export default async function ApplePaySettingsPage() {
  const me = await requireUser();
  const key = await db.query.apiKeys.findFirst({ where: eq(apiKeys.userId, me.id) });
  const myLeagues = await db
    .select({ id: leagues.id, name: leagues.name, emoji: leagues.emoji, currency: leagues.currency })
    .from(memberships)
    .innerJoin(leagues, eq(leagues.id, memberships.leagueId))
    .where(eq(memberships.userId, me.id));

  return (
    <div className="rise flex flex-col">
      <PageHeader title="Apple Pay auto-log" subtitle="Every tap lands on Review with the amount filled in." back="/settings" />
      <ApplePaySetup
        endpoint={`${appUrl()}/api/ingest/apple-pay`}
        existing={key ? { hint: key.hint, createdAt: key.createdAt.toISOString(), lastUsedAt: key.lastUsedAt?.toISOString() ?? null } : null}
        leagues={myLeagues}
      />
      <div className="h-[60px]" />
    </div>
  );
}
