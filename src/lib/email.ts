import { Resend } from "resend";
import { appUrl } from "./env";

const FROM = process.env.EMAIL_FROM || "Skint <onboarding@resend.dev>";

function client() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

function layout(title: string, bodyHtml: string, cta?: { label: string; href: string }) {
  // Paper, ink and cobalt, matching the app. Plain text wordmark: most mail clients strip SVG.
  return `<!doctype html><html><body style="margin:0;background:#f5f3ee;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#16181d">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px">
    <div style="background:#ffffff;border:1px solid #e3e0d8;border-radius:16px;padding:28px 24px">
      <div style="font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#6b6f77;margin-bottom:14px">Skint</div>
      <h1 style="font-size:24px;line-height:1.2;letter-spacing:-0.02em;margin:0 0 14px">${title}</h1>
      <div style="font-size:16px;line-height:1.5;color:#4b4f57">${bodyHtml}</div>
      ${cta ? `<a href="${cta.href}" style="display:inline-block;margin-top:24px;background:#2451b3;color:#ffffff;text-decoration:none;padding:13px 20px;border-radius:12px;font-weight:600">${cta.label}</a>` : ""}
    </div>
    <p style="margin:20px 4px 0;font-size:12px;line-height:1.5;color:#6b6f77">You get these emails because you're in a league. Turn them off in <a href="${appUrl()}/settings" style="color:#2451b3">settings</a>. Lowest wins.</p>
  </div></body></html>`;
}

export async function sendEmail(to: string, subject: string, html: string) {
  const resend = client();
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set; would send to ${to}: ${subject}`);
    return { skipped: true as const };
  }
  const { error } = await resend.emails.send({ from: FROM, to, subject, html });
  if (error) {
    console.error("[email] send failed", error);
    return { skipped: false as const, error };
  }
  return { skipped: false as const };
}

export async function sendDailyReminder(to: string, firstName: string, leagues: { id: string; name: string; emoji: string }[]) {
  const list = leagues.map((l) => `<li><a href="${appUrl()}/leagues/${l.id}/upload" style="color:#2451b3">${l.emoji} ${l.name}</a></li>`).join("");
  const html = layout(
    `${firstName}, you haven't logged today 👀`,
    `<p>No upload yet today in ${leagues.length === 1 ? "your league" : `${leagues.length} leagues`}. Screenshot what you spent, or tap "No spend today" if you were good.</p><ul>${list}</ul>`,
    { label: "Log today's spend", href: `${appUrl()}/leagues/${leagues[0].id}/upload` },
  );
  return sendEmail(to, `Daily check-in: log your spending`, html);
}

export async function sendRecapEmail(to: string, firstName: string, league: { id: string; name: string; emoji: string }, recap: { id: string; kind: "weekly" | "monthly"; periodLabel: string }, teaser: string) {
  const href = `${appUrl()}/leagues/${league.id}/wrapped/${recap.id}`;
  const html = layout(
    `Your ${recap.kind} Wrapped is ready ✨`,
    `<p>${league.emoji} <strong>${league.name}</strong> · ${recap.periodLabel}</p><p>${teaser}</p><p>Tap through to see who spent the least, who's been living large, and your own highlights, ${firstName}.</p>`,
    { label: "Open my Wrapped", href },
  );
  return sendEmail(to, `${league.emoji} ${league.name}: ${recap.kind} Wrapped is here`, html);
}

export async function sendFriendRequestEmail(to: string, fromName: string) {
  const html = layout(
    `${fromName} wants to be your friend`,
    `<p>Accept the request to start competing in leagues together.</p>`,
    { label: "See friend requests", href: `${appUrl()}/friends` },
  );
  return sendEmail(to, `${fromName} sent you a friend request`, html);
}

export async function sendLeagueInviteEmail(to: string, fromName: string, league: { id: string; name: string; emoji: string; inviteCode: string }) {
  const html = layout(
    `${fromName} added you to ${league.emoji} ${league.name}`,
    `<p>You're in. Start logging your spending, lowest total wins.</p>`,
    { label: "Open the league", href: `${appUrl()}/leagues/${league.id}` },
  );
  return sendEmail(to, `You've been added to ${league.name}`, html);
}

export async function sendChallengeEmail(to: string, challengerName: string, league: { id: string; name: string }, tx: { merchant: string; amountLabel: string }, reason: string) {
  const html = layout(
    `${challengerName} challenged your ${tx.amountLabel} at ${tx.merchant}`,
    `<p>"${reason}"</p><p>Have a look and reply in the league.</p>`,
    { label: "View the entry", href: `${appUrl()}/leagues/${league.id}/me` },
  );
  return sendEmail(to, `Challenge in ${league.name}`, html);
}
