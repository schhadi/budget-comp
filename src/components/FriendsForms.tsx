"use client";

import { useActionState } from "react";
import { sendFriendRequest, type ActionResult } from "@/actions/friends";

export function AddFriendForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(sendFriendRequest, null);
  return (
    <form action={action} className="px-4 pt-5">
      <label className="label" htmlFor="friend-email">Add by email</label>
      <div className="flex gap-2">
        <input id="friend-email" name="email" type="email" className="field" placeholder="friend@university.ac.uk" autoComplete="off" required />
        <button className="h-12 shrink-0 rounded-xl bg-accent px-[18px] text-[15px] font-semibold text-accent-ink" disabled={pending} type="submit">
          {pending ? "…" : "Add"}
        </button>
      </div>
      {state && <p className={`mt-2 text-sm ${state.ok ? "text-good" : "text-bad"}`}>{state.ok ? state.message : state.error}</p>}
      <p className="mt-2 text-xs text-muted">They need to have signed in with Google once first.</p>
    </form>
  );
}
