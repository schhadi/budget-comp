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
- **Apple Pay auto-log**: every Apple Pay tap (amount, merchant, card) lands on your Review tab via an iPhone Shortcut. Two taps to set up from Settings → Apple Pay auto-log, no keys to copy.

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

Import the repo in Vercel, add every variable from `.env.example` in Project → Settings → Environment Variables, and deploy.

`vercel.json` sets the build command to `npm run db:migrate && npm run build`, so any new migration in `drizzle/` is applied to the database before each deployment builds. Two things that relies on: `DATABASE_URL` (or `DATABASE_URL_UNPOOLED`, which the Neon integration provides and migrations prefer) must be available to the Production and Preview environments, and devDependencies must be installed during the build, which is Vercel's default as long as you don't set `NODE_ENV=production` as an environment variable. Local `npm run build` is unaffected.

`vercel.json` also registers two cron jobs:

| Cron | When (UTC) | What |
| --- | --- | --- |
| `/api/cron/daily-reminder` | 18:00 daily | Emails members of daily-upload leagues who haven't logged today |
| `/api/cron/recaps` | 07:00 daily | On Mondays writes the weekly Wrapped; on the 1st the monthly one. Emails everyone |

Vercel sends `CRON_SECRET` automatically once you add it as an environment variable. The Hobby plan allows daily crons, which is all this app needs.

## Apple Pay auto-log (iPhone Shortcut)

Apple doesn't expose Wallet transactions to apps, but the Shortcuts app's **Wallet** automation trigger (called **Transaction** on iOS 17 and 18) fires on every Apple Pay tap with the merchant, amount and card. The app turns that into a pending entry with the amount already filled in; you only tap Confirm.

**For each person** it's two taps and one automation, nothing to copy: **Settings → Apple Pay auto-log → Get the shortcut** (adds the shared shortcut from an iCloud link), **Connect this iPhone** (opens the shortcut with a one-time token; it fetches a key and keeps it on the phone), then a Wallet automation that runs the shortcut on every tap. The page walks through the automation step by step.

**For whoever runs the app, once:** build the shared shortcut on an iPhone, copy its iCloud link and set `APPLE_PAY_SHORTCUT_URL` (plus `APPLE_PAY_SHORTCUT_NAME` if you named it differently). The full recipe, with a test plan and an optional shorter mode, is in [docs/apple-pay-shortcut.md](docs/apple-pay-shortcut.md). Until it's set, the page shows the longer build-it-yourself instructions, which keep working as a fallback behind "Prefer to build the automation yourself?".

How pairing works: the settings page mints a signed 15-minute token (HMAC with `AUTH_SECRET`) into a `shortcuts://run-shortcut?name=…&input=text&text=<token>` link. The shortcut posts it to `POST /api/ingest/apple-pay/pair` together with the phone's name, gets a fresh key back and saves it to `iCloud Drive/Shortcuts/Who Can Spend the Less/key.txt`. The database keeps only a hash; a token is refused once a key newer than it exists, so a link can't be replayed; the page shows which phone is connected and when it last logged a tap.

Entries land on the **Review** tab of every league you're in, tagged 📲, with the category guessed from the merchant name (well-known UK brands by keyword, everything else by one short call to the parser model). Nothing counts until confirmed, same as a screenshot.

What the endpoint accepts: `POST /api/ingest/apple-pay` with JSON, form or query fields `merchant`, `amount` (a number or text such as `£4.50`, `4,50 €`, `GBP 12`), optional `card`, `currency`, `date` (YYYY-MM-DD), `category`, `league` (id or name to log in one league only). The shared shortcut sends `text` instead: the automation's Text action with merchant, amount and card on three lines, which the server splits (explicit fields win when both are present). The key goes in `Authorization: Bearer …`, `X-Api-Key`, or a `key` field. `GET` with the key returns the connection check. Identical entries within two minutes are dropped because Shortcuts occasionally fires twice; a blank merchant or zero amount is kept and flagged ⚠️ on Review so nothing is silently lost; a request with neither is treated as a test and logs nothing.

Limits: only Apple Pay payments trigger it (not physical card taps, transfers or direct debits), the amount is the authorisation at the tap, and the automation lives on each person's phone. Open Banking would cover everything but needs each friend to grant a hobby app read access to their bank; see the plan for that trade-off.

## How the AI parsing works

`src/lib/anthropic.ts` sends the screenshot as a base64 image with a short system prompt and a Zod schema via structured outputs, so the response is always valid JSON matching the database columns. Confidence below 60 % is flagged on the review card. Refusals fall back server-side to another model where supported, and anything that still fails can be entered manually.

## Project layout

```
src/app            routes (App Router). (app)/ is the signed-in shell.
src/actions        server actions: friends, leagues, transactions, recaps
src/lib            stats engine, dates/periods, money, AI, email, recap generation, API keys + merchant categorisation
src/components     UI (upload, review card, Wrapped story, forms)
src/db             Drizzle schema + client; drizzle/ holds SQL migrations
```
