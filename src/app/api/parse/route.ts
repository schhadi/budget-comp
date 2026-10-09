import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { leagues, screenshots, transactions } from "@/db/schema";
import { parseScreenshotImage } from "@/lib/anthropic";
import { isoDateValid, todayIn } from "@/lib/dates";
import { convertMinor } from "@/lib/fx";
import { toMinor } from "@/lib/money";

export const maxDuration = 120;

/** Runs the AI over one uploaded screenshot and creates pending transactions. */
export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const { screenshotId } = (await request.json()) as { screenshotId?: string };
  if (!screenshotId) return NextResponse.json({ error: "Missing screenshotId" }, { status: 400 });

  const shot = await db.query.screenshots.findFirst({ where: eq(screenshots.id, screenshotId) });
  if (!shot || shot.userId !== userId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const league = await db.query.leagues.findFirst({ where: eq(leagues.id, shot.leagueId) });
  if (!league) return NextResponse.json({ error: "League not found" }, { status: 404 });

  if (shot.status === "parsed") {
    const existing = await db.query.transactions.findMany({ where: eq(transactions.screenshotId, shot.id) });
    return NextResponse.json({ ok: true, created: existing.length, alreadyParsed: true });
  }

  try {
    const img = await fetch(shot.blobUrl);
    if (!img.ok) throw new Error(`Could not download the screenshot (${img.status})`);
    const data = await img.arrayBuffer();
    const today = todayIn(league.timezone);
    const parsed = await parseScreenshotImage({
      data,
      mediaType: img.headers.get("content-type") ?? shot.contentType,
      referenceDate: today,
      leagueCurrency: league.currency,
    });

    const rows: (typeof transactions.$inferInsert)[] = [];
    for (const t of parsed.transactions) {
      if (!(t.amount > 0)) continue;
      const currency = (t.currency || league.currency).toUpperCase().slice(0, 3);
      const amountMinor = toMinor(t.amount, currency);
      const occurredOn = t.date && isoDateValid(t.date) && t.date <= today ? t.date : today;
      const fx = await convertMinor(amountMinor, currency, league.currency, occurredOn);
      rows.push({
        screenshotId: shot.id,
        leagueId: league.id,
        userId,
        amountMinor,
        currency,
        amountLeagueMinor: fx.minor,
        merchant: t.merchant.trim().slice(0, 80) || "Unknown",
        category: t.category,
        occurredOn,
        status: "pending",
        confidence: t.confidence,
        notes: [t.notes, t.date ? null : "Date not visible, defaulted to today", fx.converted ? null : "FX rate unavailable, stored 1:1"].filter(Boolean).join(" · ") || null,
      });
    }
    if (rows.length) await db.insert(transactions).values(rows);

    await db
      .update(screenshots)
      .set({ status: "parsed", screenshotType: parsed.screenshot_type, rawJson: parsed, error: null })
      .where(eq(screenshots.id, shot.id));

    return NextResponse.json({ ok: true, created: rows.length, warnings: parsed.warnings, isSpending: parsed.is_spending });
  } catch (err) {
    const message = (err as Error).message ?? "Parsing failed";
    await db.update(screenshots).set({ status: "failed", error: message }).where(eq(screenshots.id, shot.id));
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
