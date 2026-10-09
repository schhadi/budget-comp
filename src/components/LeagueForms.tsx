"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/actions/friends";
import { createLeague, updateLeagueSettings } from "@/actions/leagues";

export function CreateLeagueForm({ children }: { children: React.ReactNode }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(createLeague, null);
  return (
    <form action={action} className="space-y-6">
      {children}
      {state && !state.ok && <p className="text-sm text-bad">{state.error}</p>}
      <button className="btn btn-primary w-full" disabled={pending} type="submit">{pending ? "Creating…" : "Create league"}</button>
    </form>
  );
}

export function UpdateLeagueForm({ leagueId, children }: { leagueId: string; children: React.ReactNode }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    async (_prev, fd) => updateLeagueSettings(leagueId, null, fd),
    null,
  );
  return (
    <form action={action} className="space-y-6">
      {children}
      {state && (state.ok ? <p className="text-sm text-good">{state.message}</p> : <p className="text-sm text-bad">{state.error}</p>)}
      <button className="btn btn-primary w-full" disabled={pending} type="submit">{pending ? "Saving…" : "Save settings"}</button>
    </form>
  );
}
