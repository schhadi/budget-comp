import type { League } from "@/db/schema";
import { CATEGORIES } from "@/lib/categories";
import { CURRENCIES, fromMinor } from "@/lib/money";

const TIMEZONES = ["Europe/London", "Europe/Dublin", "Europe/Paris", "Europe/Berlin", "Europe/Madrid", "Europe/Rome", "Europe/Amsterdam", "Europe/Istanbul", "Asia/Dubai", "Asia/Karachi", "Asia/Kolkata", "Asia/Singapore", "Asia/Hong_Kong", "Asia/Tokyo", "Asia/Seoul", "Australia/Sydney", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Toronto", "Africa/Lagos", "Africa/Johannesburg"];

export function LeagueSettingsFields({ league }: { league?: League | null }) {
  const currency = league?.currency ?? "GBP";
  const excluded = new Set(league?.excludedCategories ?? ["rent_bills"]);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-[4.5rem_1fr] gap-3">
        <div>
          <label className="label">Emoji</label>
          <input name="emoji" className="input text-center" defaultValue={league?.emoji ?? "🏆"} maxLength={4} />
        </div>
        <div>
          <label className="label">League name</label>
          <input name="name" className="input" defaultValue={league?.name ?? ""} placeholder="Flat 4B Frugal Cup" required maxLength={60} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Leaderboard resets</label>
          <select name="window" className="select" defaultValue={league?.window ?? "weekly"}>
            <option value="weekly">Every week (Mon–Sun)</option>
            <option value="monthly">Every month</option>
          </select>
        </div>
        <div>
          <label className="label">Currency</label>
          <select name="currency" className="select" defaultValue={currency}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className="label">Timezone (for &quot;today&quot; and reminders)</label>
          <select name="timezone" className="select" defaultValue={league?.timezone ?? "Europe/London"}>
            {TIMEZONES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="label">Don&apos;t count these categories (fun-money only)</legend>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          {CATEGORIES.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name={`exclude_${c.id}`} className="checkbox" defaultChecked={excluded.has(c.id)} />
              <span>{c.emoji} {c.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-3">
        <label className="flex items-center gap-3">
          <input type="checkbox" name="dailyUploadRequired" className="checkbox" defaultChecked={league?.dailyUploadRequired ?? true} />
          <span>
            <span className="block text-sm">Daily upload required</span>
            <span className="block text-xs text-muted">Members get an evening email if they haven&apos;t logged a spend or a &quot;no spend&quot; day.</span>
          </span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Missed-day penalty ({currency})</label>
            <input name="missedDayPenalty" inputMode="decimal" className="input" defaultValue={league ? fromMinor(league.missedDayPenaltyMinor, league.currency).toString() : "5"} />
            <p className="text-xs text-muted mt-1">Added to your total for every day you forget to log. 0 to disable.</p>
          </div>
          <div>
            <label className="label">Budget target per period ({currency}, optional)</label>
            <input name="budgetTarget" inputMode="decimal" className="input" defaultValue={league?.budgetTargetMinor != null ? fromMinor(league.budgetTargetMinor, league.currency).toString() : ""} placeholder="e.g. 60" />
          </div>
        </div>
        <div>
          <label className="label">Stake / prize (optional)</label>
          <input name="stake" className="input" defaultValue={league?.stake ?? ""} placeholder="Loser buys the first round" maxLength={140} />
        </div>
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" name="allowChallenges" className="checkbox" defaultChecked={league?.allowChallenges ?? true} />
          Let members challenge suspicious entries
        </label>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" name="weeklyRecap" className="checkbox" defaultChecked={league?.weeklyRecap ?? true} />
          Weekly Wrapped every Monday
        </label>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" name="monthlyRecap" className="checkbox" defaultChecked={league?.monthlyRecap ?? true} />
          Monthly Wrapped on the 1st
        </label>
      </div>
    </div>
  );
}
