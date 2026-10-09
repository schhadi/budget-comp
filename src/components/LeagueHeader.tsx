import Link from "next/link";
import type { League } from "@/db/schema";
import { LeagueTabs } from "./LeagueTabs";

export function LeagueHeader({ league, active, isOwner, pendingCount }: { league: League; active: string; isOwner: boolean; pendingCount?: number }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold truncate">{league.emoji} {league.name}</h1>
        {isOwner && <Link href={`/leagues/${league.id}/settings`} className="btn btn-ghost btn-sm">⚙️ Settings</Link>}
      </div>
      <LeagueTabs leagueId={league.id} active={active} pendingCount={pendingCount} />
    </div>
  );
}
