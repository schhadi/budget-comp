"use client";

import { useActionState, useEffect } from "react";
import type { ActionResult } from "@/actions/friends";
import { challengeTransaction } from "@/actions/transactions";

export function ChallengeForm({ txId, onDone }: { txId: string; onDone?: () => void }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    async (_prev, fd) => challengeTransaction(txId, null, fd),
    null,
  );
  useEffect(() => {
    if (state?.ok) onDone?.();
  }, [state, onDone]);
  return (
    <form action={action} className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <input name="reason" className="field !h-11 !rounded-[10px] !px-3" placeholder="Why? e.g. that's a refund" maxLength={300} required autoFocus />
        <button className="h-11 shrink-0 rounded-[10px] bg-accent px-3.5 text-sm font-semibold text-accent-ink" disabled={pending} type="submit">
          {pending ? "…" : "Send"}
        </button>
      </div>
      {state && !state.ok && <span className="text-xs text-bad">{state.error}</span>}
    </form>
  );
}
