"use server";

import { redirect } from "next/navigation";
import type { RecapKind } from "@/db/schema";
import { addDays, todayIn } from "@/lib/dates";
import { requireOwner } from "@/lib/league-access";
import { ensureRecap, recapPeriod } from "@/lib/recap";

/** Owner-triggered recap for the current or previous period (useful before the cron has run). */
export async function generateRecapNow(leagueId: string, kind: RecapKind, which: "current" | "previous", email: boolean) {
  const { league } = await requireOwner(leagueId);
  const today = todayIn(league.timezone);
  const current = recapPeriod(kind, today);
  const period = which === "current" ? current : recapPeriod(kind, addDays(current.start, -1));
  const { recap } = await ensureRecap(league, kind, period, { email, force: true });
  redirect(`/leagues/${leagueId}/wrapped/${recap.id}`);
}
