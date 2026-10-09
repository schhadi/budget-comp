"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import type { ActionResult } from "@/actions/friends";
import { addManualTransaction } from "@/actions/transactions";
import { CATEGORIES } from "@/lib/categories";
import { CURRENCIES } from "@/lib/money";

export function ManualEntryForm({ leagueId, currency, today }: { leagueId: string; currency: string; today: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    async (_prev, fd) => addManualTransaction(leagueId, null, fd),
    null,
  );
  useEffect(() => {
    if (state?.ok) router.push(`/leagues/${leagueId}`);
  }, [state, router, leagueId]);

  return (
    <form action={action} className="flex flex-col gap-[18px] px-4 pt-6">
      <div>
        <label className="label" htmlFor="amount">Amount</label>
        <div className="flex gap-2">
          <input id="amount" name="amount" inputMode="decimal" className="field !h-14 font-mono !text-[26px]" placeholder="0.00" required autoFocus />
          <select name="currency" className="field !h-14 !w-24 shrink-0" defaultValue={currency} aria-label="Currency">
            {[...new Set([currency, ...CURRENCIES])].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="label" htmlFor="merchant">Where</label>
        <input id="merchant" name="merchant" className="field" placeholder="Cash at the market" required maxLength={80} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="category">Category</label>
          <select id="category" name="category" className="field" defaultValue="other">
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="occurredOn">Date</label>
          <input id="occurredOn" name="occurredOn" type="date" className="field" defaultValue={today} max={today} required />
        </div>
      </div>
      {state && !state.ok && <p className="text-sm text-bad">{state.error}</p>}
      <button className="btn-primary mt-1.5" disabled={pending || state?.ok} type="submit">
        {pending ? "Adding…" : "Add entry"}
      </button>
      <p className="text-center text-xs text-muted">Manual entries have no screenshot, so friends can challenge them.</p>
    </form>
  );
}
