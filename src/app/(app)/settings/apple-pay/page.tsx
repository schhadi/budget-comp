import { eq } from "drizzle-orm";
import Link from "next/link";
import { ApplePaySetup } from "@/components/ApplePaySetup";
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
    <div className="space-y-6 max-w-lg">
      <div>
        <Link href="/settings" className="text-sm text-muted hover:text-foreground">
          ← Settings
        </Link>
        <h1 className="text-2xl font-bold mt-1">📲 Apple Pay auto-log</h1>
        <p className="text-sm text-muted mt-1">
          An iPhone Shortcut sends every Apple Pay tap here with the amount and merchant already filled in. You just confirm it on the Review tab.
        </p>
      </div>
      <ApplePaySetup
        endpoint={`${appUrl()}/api/ingest/apple-pay`}
        existing={key ? { hint: key.hint, createdAt: key.createdAt.toISOString(), lastUsedAt: key.lastUsedAt?.toISOString() ?? null } : null}
        leagues={myLeagues}
      />
    </div>
  );
}
