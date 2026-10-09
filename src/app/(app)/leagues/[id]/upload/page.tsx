import { markNoSpendDay } from "@/actions/transactions";
import { LeagueHeader } from "@/components/LeagueHeader";
import { ManualEntryForm } from "@/components/ManualEntryForm";
import { SubmitButton } from "@/components/SubmitButton";
import { UploadForm } from "@/components/UploadForm";
import { todayIn } from "@/lib/dates";
import { requireMember } from "@/lib/league-access";

export default async function UploadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { league, membership } = await requireMember(id);
  const today = todayIn(league.timezone);

  return (
    <div className="space-y-6">
      <LeagueHeader league={league} active="/upload" isOwner={membership.role === "owner"} />
      <section className="space-y-3">
        <h2 className="font-semibold">Log today&apos;s spending</h2>
        <UploadForm leagueId={league.id} />
      </section>

      <section className="card p-4 flex items-center justify-between gap-3">
        <div>
          <div className="font-medium">Spent nothing today?</div>
          <div className="text-xs text-muted">Log a no-spend day so you don&apos;t get a missed-day penalty.</div>
        </div>
        <form action={markNoSpendDay.bind(null, league.id, undefined)}>
          <SubmitButton className="btn btn-secondary btn-sm" pendingText="…">🧘 No spend</SubmitButton>
        </form>
      </section>

      <section className="card p-4 space-y-3">
        <div>
          <div className="font-medium">Add manually</div>
          <div className="text-xs text-muted">For cash, or if the AI can&apos;t read a screenshot.</div>
        </div>
        <ManualEntryForm leagueId={league.id} currency={league.currency} today={today} />
      </section>
    </div>
  );
}
