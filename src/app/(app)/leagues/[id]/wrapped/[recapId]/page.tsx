import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { recaps } from "@/db/schema";
import { WrappedStory } from "@/components/WrappedStory";
import type { RecapSlides } from "@/lib/anthropic";
import { formatDay, formatPeriodShort } from "@/lib/dates";
import { requireMember } from "@/lib/league-access";
import type { RecapStatsPayload } from "@/lib/recap";

export default async function WrappedPage({ params }: { params: Promise<{ id: string; recapId: string }> }) {
  const { id, recapId } = await params;
  const { user, league } = await requireMember(id);
  const recap = await db.query.recaps.findFirst({ where: and(eq(recaps.id, recapId), eq(recaps.leagueId, league.id)) });
  if (!recap) notFound();

  const slides = recap.slides as RecapSlides;
  const stats = recap.stats as RecapStatsPayload;
  const mine = slides.member_slides.find((m) => m.user_id === user.id)?.slides ?? [];
  const period = { start: recap.periodStart, end: recap.periodEnd };

  return (
    <WrappedStory
      leagueId={league.id}
      leagueName={league.name}
      kind={recap.kind}
      periodLabel={recap.kind === "weekly" ? formatPeriodShort(period) : formatDay(period.start, { month: "long", year: "numeric" })}
      currency={league.currency}
      leagueSlides={slides.league_slides}
      mySlides={mine}
      leaderboard={stats.leaderboard.map((r) => ({ userId: r.userId, name: r.name, rank: r.rank, totalMinor: r.totalMinor }))}
      viewerName={(user.name ?? "you").split(" ")[0]}
    />
  );
}
