"use client";

import { useActionState } from "react";
import { joinByCodeForm } from "@/actions/leagues";
import type { ActionResult } from "@/actions/friends";

export function JoinByCodeForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(joinByCodeForm, null);
  return (
    <form action={action} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          name="code"
          className="field font-mono uppercase tracking-[0.12em]"
          placeholder="INVITE CODE"
          maxLength={12}
          autoCapitalize="characters"
          autoComplete="off"
          required
        />
        <button className="h-12 shrink-0 rounded-xl border border-line2 bg-surface px-[18px] text-[15px] font-semibold" disabled={pending} type="submit">
          {pending ? "…" : "Join"}
        </button>
      </div>
      {state && !state.ok && <p className="text-xs text-bad">{state.error}</p>}
    </form>
  );
}
