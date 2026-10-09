"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/actions/friends";
import { createLeague, updateLeagueSettings } from "@/actions/leagues";

/** Fields go inside the form; `after` renders below it (e.g. other forms), above the sticky save button. */
function LeagueFormShell({
  action,
  state,
  pending,
  cta,
  pendingText,
  children,
  after,
}: {
  action: (fd: FormData) => void;
  state: ActionResult | null;
  pending: boolean;
  cta: string;
  pendingText: string;
  children: React.ReactNode;
  after?: React.ReactNode;
}) {
  return (
    <>
      <form id="league-form" action={action}>
        {children}
      </form>
      {after}
      <div className="sticky bottom-0 bg-gradient-to-t from-bg from-70% to-transparent px-4 pt-7" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 16px)" }}>
        {state && <p className={`mb-2 text-center text-sm ${state.ok ? "text-good" : "text-bad"}`}>{state.ok ? state.message : state.error}</p>}
        <button form="league-form" className="btn-primary" disabled={pending} type="submit">
          {pending ? pendingText : cta}
        </button>
      </div>
    </>
  );
}

export function CreateLeagueForm({ children }: { children: React.ReactNode }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(createLeague, null);
  return (
    <LeagueFormShell action={action} state={state} pending={pending} cta="Create league" pendingText="Creating…">
      {children}
    </LeagueFormShell>
  );
}

export function UpdateLeagueForm({ leagueId, children, after }: { leagueId: string; children: React.ReactNode; after?: React.ReactNode }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    async (_prev, fd) => updateLeagueSettings(leagueId, null, fd),
    null,
  );
  return (
    <LeagueFormShell action={action} state={state} pending={pending} cta="Save settings" pendingText="Saving…" after={after}>
      {children}
    </LeagueFormShell>
  );
}
