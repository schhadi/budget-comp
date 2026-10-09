"use client";

import { useActionState } from "react";
import { sendFriendRequest, type ActionResult } from "@/actions/friends";

export function AddFriendForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(sendFriendRequest, null);
  return (
    <form action={action} className="space-y-2">
      <div className="flex gap-2">
        <input name="email" type="email" className="input" placeholder="friend@university.ac.uk" required />
        <button className="btn btn-primary" disabled={pending} type="submit">{pending ? "…" : "Add"}</button>
      </div>
      {state && (state.ok ? <p className="text-sm text-good">{state.message}</p> : <p className="text-sm text-bad">{state.error}</p>)}
      <p className="text-xs text-muted">They need to have signed in with Google once before you can add them.</p>
    </form>
  );
}
