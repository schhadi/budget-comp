"use client";

import { useActionState } from "react";
import { joinByCodeForm } from "@/actions/leagues";
import type { ActionResult } from "@/actions/friends";

export function JoinByCodeForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(joinByCodeForm, null);
  return (
    <form action={action} className="flex gap-2">
      <input name="code" className="input uppercase tracking-widest font-mono" placeholder="INVITE CODE" maxLength={12} required />
      <button className="btn btn-secondary" disabled={pending} type="submit">{pending ? "…" : "Join"}</button>
      {state && !state.ok && <p className="text-xs text-bad self-center">{state.error}</p>}
    </form>
  );
}
