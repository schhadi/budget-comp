import type { League } from "@/db/schema";
import { CATEGORIES } from "@/lib/categories";
import { CURRENCIES, fromMinor } from "@/lib/money";
import { Icon } from "./Icon";
import { SectionHead } from "./PageHeader";
import { SwitchRow } from "./SwitchRow";

const TIMEZONES = ["Europe/London", "Europe/Dublin", "Europe/Paris", "Europe/Berlin", "Europe/Madrid", "Europe/Rome", "Europe/Amsterdam", "Europe/Istanbul", "Asia/Dubai", "Asia/Karachi", "Asia/Kolkata", "Asia/Singapore", "Asia/Hong_Kong", "Asia/Tokyo", "Asia/Seoul", "Australia/Sydney", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Toronto", "Africa/Lagos", "Africa/Johannesburg"];

function currencySymbol(currency: string) {
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency, currencyDisplay: "narrowSymbol" }).formatToParts(0).find((p) => p.type === "currency")?.value ?? currency;
  } catch {
    return currency;
  }
}

export function LeagueSettingsFields({ league }: { league?: League | null }) {
  const currency = league?.currency ?? "GBP";
  const symbol = currencySymbol(currency);
  const excluded = new Set(league?.excludedCategories ?? ["rent_bills"]);
  return (
    <>
      <input type="hidden" name="emoji" defaultValue={league?.emoji ?? "🏆"} />

      <SectionHead label="Basics" className="pt-[22px]" />
      <div className="flex flex-col gap-3.5 px-4">
        <div>
          <label className="label" htmlFor="league-name">League name</label>
          <input id="league-name" name="name" className="field" defaultValue={league?.name ?? ""} placeholder="Flat 4B Frugal Cup" required maxLength={60} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="league-window">Leaderboard resets</label>
            <select id="league-window" name="window" className="field" defaultValue={league?.window ?? "weekly"}>
              <option value="weekly">Every week</option>
              <option value="monthly">Every month</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="league-currency">Currency</label>
            <select id="league-currency" name="currency" className="field" defaultValue={currency}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="league-tz">Timezone</label>
          <select id="league-tz" name="timezone" className="field" defaultValue={league?.timezone ?? "Europe/London"}>
            {TIMEZONES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <div className="mt-1.5 text-xs text-muted">Decides what &ldquo;today&rdquo; means for reminders and penalties.</div>
        </div>
      </div>

      <SectionHead label="Not counted" right="Tap to exclude" />
      <div className="flex flex-wrap gap-2 px-4">
        {CATEGORIES.map((c) => (
          <label
            key={c.id}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-line2 bg-surface pr-3 pl-2.5 text-[13px] font-semibold text-ink2 has-checked:border-accent has-checked:bg-accent-soft has-checked:text-accent"
          >
            <input type="checkbox" name={`exclude_${c.id}`} className="sr-only" defaultChecked={excluded.has(c.id)} />
            <Icon name={c.icon} size={16} />
            {c.label}
          </label>
        ))}
      </div>

      <SectionHead label="Daily logging" />
      <SwitchRow name="dailyUploadRequired" title="Daily upload required" subtitle="Evening email if nothing is logged that day." defaultChecked={league?.dailyUploadRequired ?? true} last />
      <div className="grid grid-cols-2 gap-3 px-4 pt-3.5">
        <div>
          <label className="label" htmlFor="league-penalty">Missed-day penalty</label>
          <div className="field flex items-center gap-1.5 !px-3">
            <span className="text-muted">{symbol}</span>
            <input
              id="league-penalty"
              name="missedDayPenalty"
              inputMode="decimal"
              className="min-w-0 flex-1 bg-transparent font-mono text-base outline-none"
              defaultValue={league ? fromMinor(league.missedDayPenaltyMinor, league.currency).toString() : "5"}
            />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="league-budget">Budget target</label>
          <div className="field flex items-center gap-1.5 !px-3">
            <span className="text-muted">{symbol}</span>
            <input
              id="league-budget"
              name="budgetTarget"
              inputMode="decimal"
              className="min-w-0 flex-1 bg-transparent font-mono text-base outline-none"
              defaultValue={league?.budgetTargetMinor != null ? fromMinor(league.budgetTargetMinor, league.currency).toString() : ""}
              placeholder="optional"
            />
          </div>
        </div>
      </div>
      <div className="px-4 pt-1.5 text-xs text-muted">Penalty is added to your total for each day you forget. 0 disables it.</div>
      <div className="px-4 pt-3.5">
        <label className="label" htmlFor="league-stake">Stake or prize</label>
        <input id="league-stake" name="stake" className="field" defaultValue={league?.stake ?? ""} placeholder="Loser buys the first round" maxLength={140} />
      </div>

      <SectionHead label="Extras" />
      <SwitchRow name="allowChallenges" title="Members can challenge entries" defaultChecked={league?.allowChallenges ?? true} />
      <SwitchRow name="weeklyRecap" title="Weekly Wrapped every Monday" defaultChecked={league?.weeklyRecap ?? true} />
      <SwitchRow name="monthlyRecap" title="Monthly Wrapped on the 1st" defaultChecked={league?.monthlyRecap ?? true} last />
    </>
  );
}
