import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { recaps } from "@/db/schema";
import { Icon } from "@/components/Icon";
import { LeagueHeader } from "@/components/LeagueHeader";
import type { RecapSlides } from "@/lib/anthropic";
import { formatDay, formatPeriodShort, isoWeekNumber } from "@/lib/dates";
import { requireMember } from "@/lib/league-access";
import type { RecapStatsPayload } from "@/lib/recap";

export default async function WrappedListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, league, membership } = await requireMember(id);
  const list = await db.select().from(recaps).where(eq(recaps.leagueId, league.id)).orderBy(desc(recaps.periodStart), desc(recaps.createdAt));

  const nextNote = league.weeklyRecap ? "Next one lands Monday morning." : league.monthlyRecap ? "Next one lands on the 1st." : "Automatic recaps are off for this league.";

  return (
    <div className="rise flex flex-col">
      <LeagueHeader league={league} user={user} />
      <div className="px-4 pt-5 pb-1.5">
        <div className="text-[26px] leading-[1.15] font-semibold tracking-[-0.02em]">Wrapped</div>
        <div className="mt-1 text-sm text-muted">A recap every Monday and on the 1st, emailed to everyone.</div>
      </div>

      {list.length === 0 ? (
        <div className="mt-2.5 border-t border-line px-4 py-4 text-sm text-muted">
          No Wrapped yet.{membership.role === "owner" ? " You can generate one now from league settings." : ""}
        </div>
      ) : (
        <>
          <div className="eyebrow px-4 pt-2.5 pb-2">Past recaps</div>
          {list.map((r) => {
            const slides = r.slides as RecapSlides;
            const stats = r.stats as RecapStatsPayload;
            const mine = slides.member_slides.find((m) => m.user_id === user.id)?.slides ?? [];
            const slideCount = 2 + slides.league_slides.length + (mine.length ? mine.length + 1 : 0);
            const winner = stats.leaderboard[0];
            const winnerLabel = winner ? (winner.userId === user.id ? "You won" : `${winner.name.split(" ")[0]} won`) : null;
            const weekly = r.kind === "weekly";
            return (
              <Link key={r.id} href={`/leagues/${league.id}/wrapped/${r.id}`} className="flex min-h-[72px] items-center gap-3.5 border-t border-line px-4 py-3">
                <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-story font-mono text-story-ink">
                  <span className="text-[11px] tracking-[0.06em] opacity-70">{weekly ? "WEEK" : "MONTH"}</span>
                  <span className="text-base leading-[1.1] font-semibold">{weekly ? isoWeekNumber(r.periodStart) : formatDay(r.periodStart, { month: "2-digit" })}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-semibold">
                    {weekly ? formatPeriodShort({ start: r.periodStart, end: r.periodEnd }) : formatDay(r.periodStart, { month: "long", year: "numeric" })}
                  </div>
                  <div className="mt-0.5 text-xs text-muted">{[weekly ? "Weekly Wrapped" : "Monthly Wrapped", `${slideCount} slides`, winnerLabel].filter(Boolean).join(" · ")}</div>
                </div>
                <Icon name="play_circle" size={24} fill className="text-accent" />
              </Link>
            );
          })}
        </>
      )}
      <div className="border-t border-line px-4 pt-3.5 text-xs text-muted">{nextNote}</div>
      <div className="h-8" />
    </div>
  );
}
