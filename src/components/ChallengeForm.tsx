"use client";

import { useActionState, useState } from "react";
import type { ActionResult } from "@/actions/friends";
import { challengeTransaction } from "@/actions/transactions";

export function ChallengeForm({ txId }: { txId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    async (_prev, fd) => challengeTransaction(txId, null, fd),
    null,
  );
  if (state?.ok) return <span className="text-xs text-good">Challenged</span>;
  if (!open) return <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>Challenge</button>;
  return (
    <form action={action} className="flex gap-2 items-center w-full">
      <input name="reason" className="input" placeholder="Why? e.g. that's a refund" maxLength={300} required />
      <button className="btn btn-danger btn-sm" disabled={pending} type="submit">{pending ? "…" : "Send"}</button>
      {state && !state.ok && <span className="text-xs text-bad">{state.error}</span>}
    </form>
  );
}
