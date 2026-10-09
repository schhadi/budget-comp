import { eq } from "drizzle-orm";
import { ApplePayConnect } from "@/components/ApplePayConnect";
import { ApplePaySetup } from "@/components/ApplePaySetup";
import { Icon } from "@/components/Icon";
import { PageHeader } from "@/components/PageHeader";
import { db } from "@/db";
import { apiKeys, leagues, memberships } from "@/db/schema";
import { applePayShortcut, appUrl } from "@/lib/env";
import { mintPairToken } from "@/lib/pairing";
import { requireUser } from "@/lib/session";

export default async function ApplePaySettingsPage() {
  const me = await requireUser();
  const key = await db.query.apiKeys.findFirst({ where: eq(apiKeys.userId, me.id) });
  const myLeagues = await db
    .select({ id: leagues.id, name: leagues.name, emoji: leagues.emoji, currency: leagues.currency })
    .from(memberships)
    .innerJoin(leagues, eq(leagues.id, memberships.leagueId))
    .where(eq(memberships.userId, me.id));

  const existing = key ? { hint: key.hint, label: key.label, createdAt: key.createdAt.toISOString(), lastUsedAt: key.lastUsedAt?.toISOString() ?? null } : null;
  const endpoint = `${appUrl()}/api/ingest/apple-pay`;
  const shortcut = applePayShortcut();

  return (
    <div className="rise flex flex-col">
      <PageHeader title="Apple Pay auto-log" subtitle="Every tap lands on Review with the amount filled in." back="/settings" />
      {shortcut ? (
        <>
          <ApplePayConnect
            shortcutUrl={shortcut.url}
            shortcutName={shortcut.name}
            inputMode={shortcut.input}
            connectUrl={`shortcuts://run-shortcut?name=${encodeURIComponent(shortcut.name)}&input=text&text=${encodeURIComponent(mintPairToken(me.id))}`}
            status={existing}
            leagues={myLeagues}
          />
          <details className="group mx-4 mt-8 rounded-[12px] border border-line">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-3 text-sm font-medium text-ink2 select-none [&::-webkit-details-marker]:hidden">
              <Icon name="build" size={18} />
              Prefer to build the automation yourself?
              <Icon name="expand_more" className="ml-auto text-muted transition group-open:rotate-180" />
            </summary>
            <div className="border-t border-line pb-3">
              <ApplePaySetup endpoint={endpoint} existing={existing} leagues={myLeagues} />
            </div>
          </details>
        </>
      ) : (
        <>
          <ApplePaySetup endpoint={endpoint} existing={existing} leagues={myLeagues} />
          <p className="px-4 pt-6 text-xs text-muted">
            One-tap setup isn&apos;t switched on for this deployment yet. Whoever runs it can share the shortcut once and set <code className="font-mono">APPLE_PAY_SHORTCUT_URL</code>{" "}
            (see docs/apple-pay-shortcut.md) to replace all of the above with two taps.
          </p>
        </>
      )}
      <div className="h-[60px]" />
    </div>
  );
}
