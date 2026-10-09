import { and, asc, eq } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { screenshots, transactions } from "@/db/schema";
import { deleteScreenshot } from "@/actions/transactions";
import { LeagueHeader } from "@/components/LeagueHeader";
import { ReviewCard } from "@/components/ReviewCard";
import { requireMember } from "@/lib/league-access";

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, league, membership } = await requireMember(id);

  const pending = await db
    .select({ tx: transactions, shotUrl: screenshots.blobUrl })
    .from(transactions)
    .leftJoin(screenshots, eq(screenshots.id, transactions.screenshotId))
    .where(and(eq(transactions.leagueId, league.id), eq(transactions.userId, user.id), eq(transactions.status, "pending")))
    .orderBy(asc(transactions.createdAt));

  const failed = await db
    .select()
    .from(screenshots)
    .where(and(eq(screenshots.leagueId, league.id), eq(screenshots.userId, user.id), eq(screenshots.status, "failed")));

  return (
    <div className="space-y-6">
      <LeagueHeader league={league} active="/review" isOwner={membership.role === "owner"} pendingCount={pending.length} />

      {pending.length === 0 && failed.length === 0 && (
        <div className="card p-6 text-center">
          <div className="text-4xl">🎉</div>
          <p className="mt-3 font-medium">Nothing to review.</p>
          <Link href={`/leagues/${league.id}/upload`} className="btn btn-primary btn-sm mt-4">Upload more</Link>
        </div>
      )}

      {pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold">Confirm what the AI read <span className="text-muted text-sm font-normal">· edit anything that&apos;s wrong</span></h2>
          {pending.map(({ tx, shotUrl }) => (
            <ReviewCard
              key={tx.id}
              leagueCurrency={league.currency}
              tx={{
                id: tx.id,
                amountMinor: tx.amountMinor,
                currency: tx.currency,
                merchant: tx.merchant,
                category: tx.category,
                occurredOn: tx.occurredOn,
                confidence: tx.confidence,
                notes: tx.notes,
                screenshotUrl: shotUrl,
              }}
            />
          ))}
        </section>
      )}

      {failed.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold text-bad">Couldn&apos;t read these</h2>
          {failed.map((s) => (
            <div key={s.id} className="card p-3 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.blobUrl} alt="" className="w-12 h-12 rounded-lg object-cover" />
              <div className="flex-1 text-xs text-muted min-w-0 truncate">{s.error}</div>
              <form action={deleteScreenshot.bind(null, s.id)}><button className="btn btn-ghost btn-sm">Remove</button></form>
            </div>
          ))}
          <p className="text-xs text-muted">Tip: add these manually from the Upload tab.</p>
        </section>
      )}
    </div>
  );
}
