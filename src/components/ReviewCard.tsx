"use client";

import { useActionState, useState } from "react";
import { confirmTransaction, rejectTransaction } from "@/actions/transactions";
import type { ActionResult } from "@/actions/friends";
import { CATEGORIES } from "@/lib/categories";
import { CURRENCIES, fromMinor } from "@/lib/money";

export interface ReviewTx {
  id: string;
  amountMinor: number;
  currency: string;
  merchant: string;
  category: string;
  occurredOn: string;
  confidence: number | null;
  notes: string | null;
  source?: "screenshot" | "manual" | "apple_pay" | null;
  screenshotUrl: string | null;
}

export function ReviewCard({ tx, leagueCurrency }: { tx: ReviewTx; leagueCurrency: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    async (_prev, formData) => confirmTransaction(tx.id, formData),
    null,
  );
  const [showImage, setShowImage] = useState(false);
  const lowConfidence = (tx.confidence ?? 1) < 0.6;
  const applePay = tx.source === "apple_pay";
  const amountMissing = applePay && tx.amountMinor <= 0;

  if (state?.ok) {
    return (
      <div className="card p-4 flex items-center gap-3 slide-in">
        <span className="text-2xl">✅</span>
        <div className="text-sm">
          <div className="font-medium">Confirmed</div>
          <div className="text-muted">Counted on the leaderboard.</div>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="card p-4 space-y-3 slide-in">
      <div className="flex items-start gap-3">
        {tx.screenshotUrl ? (
          <button type="button" onClick={() => setShowImage((v) => !v)} className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={tx.screenshotUrl} alt="screenshot" className="w-16 h-16 rounded-lg object-cover bg-card-2 border border-border" />
          </button>
        ) : (
          <div className="w-16 h-16 rounded-lg bg-card-2 flex items-center justify-center text-2xl">{applePay ? "📲" : "🧾"}</div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {applePay ? (
              <>
                <span className="pill">📲 Apple Pay</span>
                {amountMissing ? (
                  <span className="pill text-warn border-warn/40">⚠️ add the amount</span>
                ) : lowConfidence ? (
                  <span className="pill text-warn border-warn/40">⚠️ check the category</span>
                ) : null}
              </>
            ) : (
              <span className={`pill ${lowConfidence ? "text-warn border-warn/40" : ""}`}>
                {lowConfidence ? "⚠️ double check" : "AI read"} · {Math.round((tx.confidence ?? 0) * 100)}%
              </span>
            )}
          </div>
          {tx.notes && <p className="text-xs text-muted mt-1">{tx.notes}</p>}
        </div>
      </div>

      {showImage && tx.screenshotUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={tx.screenshotUrl} alt="screenshot" className="w-full rounded-xl border border-border" />
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Amount</label>
          <input
            name="amount"
            inputMode="decimal"
            className="input"
            defaultValue={amountMissing ? "" : fromMinor(tx.amountMinor, tx.currency).toFixed(2)}
            placeholder={amountMissing ? "Check your bank app" : undefined}
            required
          />
        </div>
        <div>
          <label className="label">Currency</label>
          <select name="currency" className="select" defaultValue={tx.currency}>
            {[...new Set([tx.currency, leagueCurrency, ...CURRENCIES])].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className="label">Merchant</label>
          <input name="merchant" className="input" defaultValue={tx.merchant} required maxLength={80} />
        </div>
        <div>
          <label className="label">Category</label>
          <select name="category" className="select" defaultValue={tx.category}>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Date</label>
          <input name="occurredOn" type="date" className="input" defaultValue={tx.occurredOn} required />
        </div>
      </div>

      {state && !state.ok && <p className="text-sm text-bad">{state.error}</p>}

      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary flex-1" disabled={pending}>
          {pending ? "Saving…" : "Confirm"}
        </button>
        <button
          type="button"
          className="btn btn-danger"
          disabled={pending}
          onClick={() => {
            if (confirm("Reject this entry? It won't count.")) void rejectTransaction(tx.id);
          }}
        >
          Reject
        </button>
      </div>
    </form>
  );
}
