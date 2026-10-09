# Who Can Spend the Less? 🏆

A leaderboard app for uni friends competing to spend the least. Upload screenshots of what you spend, an AI reads them, confirm with one tap, and the lowest total wins. Weekly and monthly "Wrapped" recaps land in your inbox.

Built with Next.js (App Router), Neon Postgres + Drizzle, Auth.js (Google), Vercel Blob, Resend and the Anthropic SDK. Deploys to Vercel's free tier.

## Features

- **Google sign-in**, friends list (add by email), invite-only leagues with a share link.
- **Screenshot upload → AI extraction** of amount, merchant, category, date. Multiple transactions per image (bank-app lists) are split out. Everything is reviewed and confirmed by you before it counts.
- **Leaderboard** per week or month, lowest wins. League parameters: currency, timezone, excluded categories (e.g. rent), missed-day penalty, budget target, stake, challenges on/off, which recaps to send.
- **Daily upload**: evening email reminder if you haven't logged a spend or a "no spend day". Streaks and penalties keep people honest.
- **Wrapped**: Spotify-style story every Monday (week) and on the 1st (month), with league-wide slides and personal slides, emailed to everyone. Owners can generate one on demand from Settings.
- **Challenges**: league mates can flag a dodgy entry; the owner of the entry (or the league owner) rules on it.
- **Badges**: spent the least, big spender, logged every day, no takeaways, monk mode.
- Manual entries for cash, multi-currency with automatic conversion to the league currency.

## Setup

1. **Clone and install**

   ```bash
   npm install
   cp .env.example .env.local
   ```

2. **Database** – create a Neon Postgres database (free tier; the Vercel Marketplace "Neon" integration sets `DATABASE_URL` for you). Then push the schema:

   ```bash
   npm run db:migrate
   ```

3. **Google sign-in** – in Google Cloud Console create an OAuth 2.0 Client ID (Web application). Add these authorised redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://<your-vercel-domain>/api/auth/callback/google`

   Put the client ID and secret in `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`. Generate `AUTH_SECRET` with `npx auth secret`.

4. **Vercel Blob** – add Blob storage from the Storage tab of the Vercel project; it sets `BLOB_READ_WRITE_TOKEN`.

5. **Anthropic** – create an API key at console.anthropic.com and set `ANTHROPIC_API_KEY`. The default model is `claude-opus-5-5`; set `PARSER_MODEL=claude-haiku-5-5` for the cheapest option.

6. **Email** – create a Resend account, verify a sending domain, set `RESEND_API_KEY` and `EMAIL_FROM`. Without a verified domain, Resend only delivers to your own address.

7. **Run locally**

   ```bash
   npm run dev
   ```

## Deploy to Vercel

Import the repo in Vercel, add every variable from `.env.example` in Project → Settings → Environment Variables, and deploy. `vercel.json` registers two cron jobs:

| Cron | When (UTC) | What |
| --- | --- | --- |
| `/api/cron/daily-reminder` | 18:00 daily | Emails members of daily-upload leagues who haven't logged today |
| `/api/cron/recaps` | 07:00 daily | On Mondays writes the weekly Wrapped; on the 1st the monthly one. Emails everyone |

Vercel sends `CRON_SECRET` automatically once you add it as an environment variable. The Hobby plan allows daily crons, which is all this app needs.

## How the AI parsing works

`src/lib/anthropic.ts` sends the screenshot as a base64 image with a short system prompt and a Zod schema via structured outputs, so the response is always valid JSON matching the database columns. Confidence below 60 % is flagged on the review card. Refusals fall back server-side to another model where supported, and anything that still fails can be entered manually.

## Project layout

```
src/app            routes (App Router). (app)/ is the signed-in shell.
src/actions        server actions: friends, leagues, transactions, recaps
src/lib            stats engine, dates/periods, money, AI, email, recap generation
src/components     UI (upload, review card, Wrapped story, forms)
src/db             Drizzle schema + client; drizzle/ holds SQL migrations
```
