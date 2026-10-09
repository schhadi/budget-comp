import { ManualEntryForm } from "@/components/ManualEntryForm";
import { PageHeader } from "@/components/PageHeader";
import { todayIn } from "@/lib/dates";
import { requireMember } from "@/lib/league-access";

export default async function ManualEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { league } = await requireMember(id);
  return (
    <div className="rise flex flex-col">
      <PageHeader title="Enter manually" back={`/leagues/${id}/upload`} />
      <ManualEntryForm leagueId={league.id} currency={league.currency} today={todayIn(league.timezone)} />
    </div>
  );
}
