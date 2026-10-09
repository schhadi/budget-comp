import { deleteLeague } from "@/actions/leagues";
import { generateRecapNow } from "@/actions/recaps";
import { LeagueHeader } from "@/components/LeagueHeader";
import { UpdateLeagueForm } from "@/components/LeagueForms";
import { LeagueSettingsFields } from "@/components/LeagueSettingsFields";
import { SubmitButton } from "@/components/SubmitButton";
import { requireOwner } from "@/lib/league-access";

export default async function LeagueSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { league } = await requireOwner(id);

  return (
    <div className="space-y-6 max-w-lg">
      <LeagueHeader league={league} active="/settings" isOwner />

      <UpdateLeagueForm leagueId={league.id}>
        <div className="card p-4">
          <LeagueSettingsFields league={league} />
        </div>
      </UpdateLeagueForm>

      <section className="card p-4 space-y-3">
        <div>
          <div className="font-medium">Generate a Wrapped now</div>
          <p className="text-xs text-muted">Normally this happens automatically on Mondays and the 1st. Use this to preview or re-run one. Ticking &quot;email&quot; sends it to everyone.</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(["weekly", "monthly"] as const).map((kind) =>
            (["current", "previous"] as const).map((which) => (
              <form key={`${kind}-${which}`} action={generateRecapNow.bind(null, league.id, kind, which, false)}>
                <SubmitButton className="btn btn-secondary btn-sm w-full" pendingText="Writing…">{which === "current" ? "This" : "Last"} {kind === "weekly" ? "week" : "month"}</SubmitButton>
              </form>
            )),
          )}
        </div>
        <form action={generateRecapNow.bind(null, league.id, league.window, "previous", true)}>
          <SubmitButton className="btn btn-primary btn-sm w-full" pendingText="Writing & emailing…">Generate last {league.window === "weekly" ? "week" : "month"} and email everyone</SubmitButton>
        </form>
      </section>

      <section className="card p-4 space-y-2 border-bad/30">
        <div className="font-medium text-bad">Danger zone</div>
        <p className="text-xs text-muted">Deleting removes all uploads, entries and recaps for everyone. No undo.</p>
        <form action={deleteLeague.bind(null, league.id)}>
          <SubmitButton className="btn btn-danger btn-sm" pendingText="Deleting…">Delete league</SubmitButton>
        </form>
      </section>
    </div>
  );
}
