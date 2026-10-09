"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/actions/friends";
import { addManualTransaction } from "@/actions/transactions";
import { CATEGORIES } from "@/lib/categories";
import { CURRENCIES } from "@/lib/money";

export function ManualEntryForm({ leagueId, currency, today }: { leagueId: string; currency: string; today: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    async (_prev, fd) => addManualTransaction(leagueId, null, fd),
    null,
  );
  return (
    <form action={action} className="grid grid-cols-2 gap-3">
      <div>
        <label className="label">Amount</label>
        <input name="amount" inputMode="decimal" className="input" placeholder="3.20" required />
      </div>
      <div>
        <label className="label">Currency</label>
        <select name="currency" className="select" defaultValue={currency}>
          {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="col-span-2">
        <label className="label">Where</label>
        <input name="merchant" className="input" placeholder="Cash at the market" required maxLength={80} />
      </div>
      <div>
        <label className="label">Category</label>
        <select name="category" className="select" defaultValue="other">
          {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Date</label>
        <input name="occurredOn" type="date" className="input" defaultValue={today} max={today} required />
      </div>
      {state && (state.ok ? <p className="col-span-2 text-sm text-good">{state.message}</p> : <p className="col-span-2 text-sm text-bad">{state.error}</p>)}
      <button className="btn btn-secondary col-span-2" disabled={pending} type="submit">{pending ? "Adding…" : "Add without screenshot"}</button>
    </form>
  );
}
