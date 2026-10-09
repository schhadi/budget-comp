import { LeagueTabs } from "@/components/LeagueTabs";

export default async function LeagueLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="flex flex-1 flex-col">
      {children}
      <LeagueTabs leagueId={id} />
    </div>
  );
}
