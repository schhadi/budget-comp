import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { recaps } from "@/db/schema";
import { LeagueHeader } from "@/components/LeagueHeader";
import { formatPeriod } from "@/lib/dates";
import { requireMember } from "@/lib/league-access";

export default async function WrappedListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { league, membership } = await requireMember(id);
  const list = await db.select().from(recaps).where(eq(recaps.leagueId, league.id)).orderBy(desc(recaps.periodStart), desc(recaps.createdAt));

  return (
    <div className="space-y-6">
      <LeagueHeader league={league} active="/wrapped" isOwner={membership.role === "owner"} />
      {list.length === 0 && (
        <div className="card p-6 text-center">
          <div className="text-4xl">✨</div>
          <p className="mt-3 font-medium">No Wrapped yet.</p>
          <p className="text-sm text-muted mt-1">Your first one lands {league.weeklyRecap ? "on Monday morning" : "on the 1st"}, with an email.{membership.role === "owner" ? " Or generate one now from Settings." : ""}</p>
        </div>
      )}
      <div className="grid gap-3">
        {list.map((r) => (
          <Link key={r.id} href={`/leagues/${league.id}/wrapped/${r.id}`} className={`rounded-2xl p-5 text-white bg-gradient-to-br ${r.kind === "weekly" ? "from-fuchsia-600 to-indigo-900" : "from-amber-400 to-rose-800"} hover:opacity-95`}>
            <div className="uppercase tracking-[0.2em] text-xs opacity-80">{r.kind} Wrapped</div>
            <div className="text-2xl font-black mt-1">{formatPeriod({ start: r.periodStart, end: r.periodEnd })}</div>
            <div className="text-sm opacity-80 mt-2">Tap to play →</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
