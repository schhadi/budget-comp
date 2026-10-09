import { deleteLeague } from "@/actions/leagues";
import { generateRecapNow } from "@/actions/recaps";
import { UpdateLeagueForm } from "@/components/LeagueForms";
import { LeagueSettingsFields } from "@/components/LeagueSettingsFields";
import { PageHeader, SectionHead } from "@/components/PageHeader";
import { SubmitButton } from "@/components/SubmitButton";
import { requireOwner } from "@/lib/league-access";

export default async function LeagueSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { league } = await requireOwner(id);
  const unit = league.window === "weekly" ? "week" : "month";

  const extras = (
    <>
      <SectionHead label="Generate a Wrapped now" />
      <div className="px-4 text-xs text-muted">Normally automatic on Mondays and the 1st. Use this to preview or re-run one.</div>
      <div className="grid grid-cols-2 gap-2 px-4 pt-3">
        {(["weekly", "monthly"] as const).map((kind) =>
          (["current", "previous"] as const).map((which) => (
            <form key={`${kind}-${which}`} action={generateRecapNow.bind(null, league.id, kind, which, false)}>
              <SubmitButton className="btn-outline !h-11 w-full" pendingText="Writing…">
                {which === "current" ? "This" : "Last"} {kind === "weekly" ? "week" : "month"}
              </SubmitButton>
            </form>
          )),
        )}
      </div>
      <form className="px-4 pt-2" action={generateRecapNow.bind(null, league.id, league.window, "previous", true)}>
        <SubmitButton className="btn-outline !h-11 w-full !text-accent" pendingText="Writing & emailing…">
          Generate last {unit} and email everyone
        </SubmitButton>
      </form>

      <SectionHead label="Danger zone" tone="bad" className="pt-[30px]" />
      <div className="px-4 text-xs text-muted">Deleting removes all uploads, entries and recaps for everyone. No undo.</div>
      <form className="px-4 pt-3" action={deleteLeague.bind(null, league.id)}>
        <SubmitButton className="btn-outline !h-11 !px-4 !text-bad" pendingText="Deleting…">
          Delete league
        </SubmitButton>
      </form>
    </>
  );

  return (
    <div className="rise flex flex-1 flex-col">
      <PageHeader title="League settings" back={`/leagues/${league.id}`} />
      <UpdateLeagueForm leagueId={league.id} after={extras}>
        <LeagueSettingsFields league={league} />
      </UpdateLeagueForm>
    </div>
  );
}
