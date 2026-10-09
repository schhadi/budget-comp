import { and, asc, eq } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { screenshots, transactions } from "@/db/schema";
import { deleteScreenshot } from "@/actions/transactions";
import { Icon } from "@/components/Icon";
import { PageHeader, SectionHead } from "@/components/PageHeader";
import { ReviewCard } from "@/components/ReviewCard";
import { requireMember } from "@/lib/league-access";

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, league } = await requireMember(id);

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
    <div className="rise flex flex-col">
      <PageHeader
        title="Confirm entries"
        subtitle="Only confirmed entries count. Edit anything the AI got wrong."
        back={`/leagues/${id}`}
        right={pending.length > 0 ? <div className="shrink-0 font-mono text-sm text-muted">{pending.length} left</div> : undefined}
      />

      {pending.length === 0 && failed.length === 0 && (
        <div className="flex flex-col items-center gap-2.5 px-8 py-16 text-center">
          <span className="icon icon-fill text-good" style={{ fontSize: 44, fontVariationSettings: "'FILL' 1, 'wght' 300, 'GRAD' 0, 'opsz' 48" }} aria-hidden>
            task_alt
          </span>
          <div className="text-lg font-semibold">All caught up</div>
          <div className="text-sm text-muted">Everything you uploaded is on the leaderboard.</div>
          <Link href={`/leagues/${id}`} className="btn-outline mt-2.5 !h-11 !px-[18px]">
            Back to the board
          </Link>
        </div>
      )}

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

      {failed.length > 0 && (
        <>
          <SectionHead label="Couldn't read these" tone="bad" />
          {failed.map((s) => (
            <div key={s.id} className="flex min-h-16 items-center gap-3 border-t border-line py-2.5 pr-2 pl-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.blobUrl} alt="" className="hatch h-11 w-11 shrink-0 rounded-lg object-cover" />
              <div className="min-w-0 flex-1 truncate text-xs text-muted">{s.error}</div>
              <form action={deleteScreenshot.bind(null, s.id)}>
                <button className="btn-text !text-muted">Remove</button>
              </form>
            </div>
          ))}
          <Link href={`/leagues/${id}/manual`} className="flex items-center gap-1.5 border-t border-line px-4 pt-3 text-[13px] font-semibold text-accent">
            <Icon name="edit" size={18} />
            Enter these manually
          </Link>
        </>
      )}
      <div className="h-[60px]" />
    </div>
  );
}
