import Link from "next/link";
import { redirect } from "next/navigation";
import { markNoSpendDay } from "@/actions/transactions";
import { BackButton } from "@/components/BackButton";
import { SectionHead } from "@/components/PageHeader";
import { UploadForm, UploadRow } from "@/components/UploadForm";
import { formatDay, todayIn } from "@/lib/dates";
import { requireMember } from "@/lib/league-access";

export default async function UploadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { league } = await requireMember(id);
  const today = todayIn(league.timezone);

  async function noSpend() {
    "use server";
    await markNoSpendDay(id);
    redirect(`/leagues/${id}`);
  }

  return (
    <div className="rise flex flex-col">
      <header className="topbar flex items-center justify-between gap-3 pr-2 pl-4">
        <div className="min-w-0">
          <div className="text-xl font-semibold tracking-[-0.01em]">Log spending</div>
          <div className="truncate text-xs text-muted">
            {formatDay(today, { weekday: "long", day: "numeric", month: "long" })} · {league.name}
          </div>
        </div>
        <BackButton fallback={`/leagues/${id}`} icon="close" label="Close" />
      </header>

      <UploadForm leagueId={league.id}>
        <SectionHead label="Without a screenshot" className="pt-[22px]" />
        <Link href={`/leagues/${id}/manual`} className="block">
          <UploadRow icon="edit" tone="plain" title="Enter manually" subtitle="Cash, or when the AI can't read it" chevron />
        </Link>
        <form action={noSpend} className="border-b border-line">
          <button type="submit" className="block w-full text-left">
            <UploadRow icon="check_circle" tone="good" title="No spend today" subtitle="Counts as logged, no penalty" />
          </button>
        </form>
      </UploadForm>
      <div className="h-[60px]" />
    </div>
  );
}
