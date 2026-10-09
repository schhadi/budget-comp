# Who Can Spend the Less? — Project Plan

A small, fun leaderboard web app for a group of university friends. Everyone uploads
screenshots of what they spend (bank app, receipts, Deliveroo, Amazon, etc.), an AI
reads the amount and category out of the screenshot, and the leaderboard shows who is
spending the least this week / month / term.

Hosted on Vercel. Everything below is chosen to be free-tier friendly and cheap to run.

---

## 1. How it works (user flow)

1. Someone creates a **league** ("Flat 4B", "SOAS Econ 2nd years") and gets an invite link.
2. Friends join with the link and pick a display name + avatar.
3. Each person uploads a screenshot whenever they spend money (or a batch at the end of the day).
4. The AI reads the screenshot and proposes: amount, currency, merchant, category, date.
5. The user confirms or edits the proposal in one tap. Only confirmed entries count.
6. The leaderboard ranks players by total spend for the current period (lowest wins).
7. At the end of each period a winner is crowned, badges are awarded, and a new round starts.

The confirm step is important: the AI will sometimes misread a screenshot, and a
leaderboard that people trust needs every number to have been looked at by a human.

---

## 2. Tech stack

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Next.js (App Router) + TypeScript | First-class on Vercel, server actions for uploads, one repo for UI and API |
| Styling | Tailwind CSS + shadcn/ui | Fast to build a clean mobile-first UI |
| Database | Postgres via Neon (Vercel Marketplace) + Drizzle ORM | Free tier, serverless-friendly, typed queries |
| File storage | Vercel Blob | Store the uploaded screenshots, private URLs |
| Auth | Auth.js (next-auth) with magic-link email, or Google sign-in | No passwords to manage. Leagues are invite-only so public sign-up is fine |
| AI parsing | Anthropic SDK (`@anthropic-ai/sdk`) with vision + structured outputs | One request per screenshot returns typed JSON |
| Background work | Route handler called right after upload, with `after()` for non-blocking work | Keeps the upload fast; no queue service needed at this scale |
| Hosting | Vercel (Hobby plan is enough) | Requested by you |

### AI model choice

- **Default: `claude-opus-5-5`.** Best accuracy on messy screenshots (cropped bank apps, dark mode, receipts photographed at an angle, mixed currencies). Thinking is always on, so set `output_config.effort` to `low` for this task to keep it fast and cheap.
- **Budget option: `claude-haiku-5-5`** at roughly 1/40th of the price. Fine for clean bank-app screenshots. Can be switched with one env var (`PARSER_MODEL`).
- Cost reality check: a screenshot is roughly 1,500 input tokens. Even on Opus 5.5 that is well under a cent per upload, so a group of five friends uploading daily costs pennies a month.
- Use **structured outputs** (`output_config.format` with a JSON schema) so the response is guaranteed to be valid JSON with the exact fields we store. No regex, no "please answer in JSON" prompting.
- Enable the server-side refusal `fallbacks: "default"` so an occasional safety refusal on a weird image doesn't break the upload.

Schema the parser returns:

```json
{
  "transactions": [
    {
      "amount": 4.50,
      "currency": "GBP",
      "merchant": "Pret A Manger",
      "category": "food_out",
      "date": "2026-10-08",
      "confidence": 0.92,
      "notes": "Card payment, contactless"
    }
  ],
  "screenshot_type": "bank_app | receipt | order_confirmation | other",
  "warnings": ["Date not visible, used today's date"]
}
```

A screenshot can contain several transactions (a bank-app list), so the parser always returns an array. Each one becomes a separate pending entry for the user to confirm.

Categories (fixed list so the leaderboard can break them down): `groceries`, `food_out`, `coffee`, `drinks_nights_out`, `transport`, `rent_bills`, `subscriptions`, `shopping`, `books_uni`, `health`, `other`.

### Fair-play rules the app enforces

- Entries must be confirmed by the uploader before they count.
- Every confirmed entry keeps a link to its screenshot so friends can audit each other.
- Duplicate detection: same amount + merchant + date within a league flags a possible double upload.
- Anyone in the league can "challenge" an entry; the uploader gets a notification and must respond.
- Optional honesty mode: players set a self-reported expected spend at the start of a period. Finishing far below it with few uploads shows a "suspiciously quiet" marker.

---

## 3. Data model

```
users          id, email, name, avatar_url, created_at
leagues        id, name, invite_code, period_type (weekly|monthly|term), currency, created_by
memberships    user_id, league_id, joined_at, role (owner|member)
periods        id, league_id, starts_at, ends_at, winner_user_id
screenshots    id, user_id, league_id, blob_url, uploaded_at, parse_status, raw_ai_json
transactions   id, screenshot_id, user_id, league_id, period_id,
               amount, currency, amount_in_league_currency, merchant, category,
               occurred_at, status (pending|confirmed|rejected|challenged), confidence
challenges     id, transaction_id, raised_by, reason, resolved, created_at
badges         id, user_id, league_id, period_id, type, awarded_at
```

Amounts are stored as integers in minor units (pence) to avoid float bugs.

---

## 4. Screens

1. **Landing / sign in** – one button, magic link.
2. **My leagues** – list of leagues, create or join by code.
3. **League home (the main screen)**
   - Leaderboard for the current period: rank, avatar, total spend, delta vs last period, streak.
   - "Upload spend" floating button (camera or file picker, accepts multiple images).
   - Pending entries that still need confirmation (red badge).
   - Countdown to period end.
4. **Confirm entry** – screenshot on the left, AI-filled form on the right (amount, merchant, category, date). Confirm / edit / reject.
5. **My spending** – list and simple charts: by category, by day, running total vs the group average.
6. **Player profile** – badges, past rankings, "most spent on" category.
7. **League settings** – period type, currency, members, invite link, reset.

Mobile-first. Most uploads will come from a phone right after taking the screenshot.

---

## 5. Feature suggestions

### Must-have for v1
- Create / join league with invite code.
- Screenshot upload (multi-file) → AI parse → confirm → leaderboard.
- Weekly or monthly periods with automatic rollover and a winner.
- Category breakdown per person.
- Screenshot audit trail visible to the whole league.

### Makes it fun (v1.5)
- **Badges / achievements**: "Frugal Fortnight" (lowest 2 weeks in a row), "No Deliveroo" (zero food_out in a period), "Early Bird" (uploads within an hour of spending), "Big Spender" (shame badge for the top spender), "Receipt Hoarder" (most uploads).
- **Streaks**: consecutive days with at least one upload, so people keep logging honestly.
- **Weekly recap**: an AI-written, slightly cheeky summary posted on the league page ("Yusuf spent £31 on coffee. Yusuf, blink twice if you need help.").
- **Head-to-head view**: pick two players and compare category by category.
- **Punishment / prize**: league owner sets a stake ("loser buys the pints"). Shown on the leaderboard.
- **Daily budget pace line**: a chart showing whether you are ahead or behind your target pace for the period.
- **Push notifications / email digest**: "You have 3 entries to confirm", "Period ends tomorrow", "Someone challenged your £2.40 Tesco entry".

### Student-specific
- **Essential vs fun spending toggle**: rent, bills and textbooks can be excluded from the competition so people with pricier accommodation aren't penalised. Leaderboard can be "fun money only".
- **Term calendar**: period type "term" with reading week markers, so the competition lines up with the academic year.
- **Student discount tracker**: the AI flags merchants where a UNiDAYS / TOTUM discount exists and you didn't appear to use it.
- **Meal plan vs eating out**: shows how much eating out cost compared to the group's groceries average.
- **Multi-currency**: friends studying abroad or on exchange can log in EUR/USD; converted to the league currency at the day's rate (free API such as frankfurter.app).

### Clever AI uses beyond parsing
- **Bank statement bulk import**: upload a PDF statement at the end of the month and the AI extracts every line, then you tick which ones count.
- **Auto-categorisation learning**: the model is shown the user's past merchant → category corrections as examples in the prompt, so it stops miscategorising Lidl as shopping.
- **"Is this real?" check**: when a challenge is raised, the AI compares the screenshot to known UI patterns of that bank app and reports anything odd (mismatched fonts, wrong date format). Advisory only.
- **Spending coach**: ask questions in natural language ("How much did I spend on coffee compared to Sam?") answered from the database via tool use.

### Nice-to-have later
- Shareable end-of-period image card for Instagram / WhatsApp.
- Open Banking connection (TrueLayer sandbox) to pull transactions automatically. Big step up in complexity and privacy; screenshots are fine for a friend group.
- PWA install prompt so it sits on the home screen like an app.
- Dark mode.

---

## 6. Build order (milestones)

| # | Milestone | Rough effort |
| --- | --- | --- |
| 1 | Next.js scaffold, Tailwind, shadcn, Drizzle + Neon, Auth.js magic link. Deploy to Vercel. | Half a day |
| 2 | Leagues: create, invite code, join, members list. | Half a day |
| 3 | Upload: Vercel Blob upload, screenshot record, Anthropic parse route with structured output, pending entries. | 1 day |
| 4 | Confirm / edit / reject flow, duplicate detection. | Half a day |
| 5 | Leaderboard for the current period, period rollover (Vercel Cron, daily), winner. | 1 day |
| 6 | My spending page with category and daily charts. | Half a day |
| 7 | Badges, streaks, challenges. | 1 day |
| 8 | Weekly AI recap, notifications (email via Resend). | Half a day |
| 9 | Polish: mobile UX, PWA manifest, loading states, error handling. | Half a day |

Milestones 1 to 5 are a working v1 you can start playing with.

---

## 7. Setup you will need to do

- A Vercel account and project (free Hobby plan).
- Neon Postgres and Vercel Blob added from the Vercel Marketplace (both have free tiers).
- An Anthropic API key, set as `ANTHROPIC_API_KEY` in Vercel environment variables.
- An email sender for magic links (Resend free tier) or a Google OAuth client if you prefer Google sign-in.

Environment variables the app will read:

```
DATABASE_URL
BLOB_READ_WRITE_TOKEN
ANTHROPIC_API_KEY
PARSER_MODEL=claude-opus-5-5
AUTH_SECRET
AUTH_RESEND_KEY   (or GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)
NEXT_PUBLIC_APP_URL
```

---

## 8. Decisions (confirmed)

1. Sign-in: **Google**.
2. Friends system: add by email, accept requests, then add friends to leagues. Invite link as a backup.
3. Daily upload required by default, with an evening email reminder and an optional missed-day penalty.
4. Wrapped recaps every week (Monday) and every month (1st), emailed to everyone.
5. League parameters: window (weekly/monthly), currency, timezone, excluded categories, daily upload, penalty, budget target, stake, challenges, which recaps.
6. Parser model: Opus 5.5 by default, Haiku 5.5 via `PARSER_MODEL` to go cheaper.
7. Leagues are visible to members only.
