"use client";

import { useActionState, useState, useTransition } from "react";
import { confirmTransaction, rejectTransaction } from "@/actions/transactions";
import type { ActionResult } from "@/actions/friends";
import { CATEGORIES } from "@/lib/categories";
import { CURRENCIES, formatMoney, fromMinor } from "@/lib/money";
import { Icon } from "./Icon";

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
  const [rejecting, startReject] = useTransition();
  const [showImage, setShowImage] = useState(false);
  const confidence = Math.round((tx.confidence ?? 0) * 100);
  const low = (tx.confidence ?? 1) < 0.6;
  const applePay = tx.source === "apple_pay";
  const amountMissing = applePay && tx.amountMinor <= 0;
  const busy = pending || rejecting;

  if (state?.ok) {
    return (
      <div className="rise flex items-center gap-3 border-b border-line px-4 py-4 text-good">
        <Icon name="check_circle" fill />
        <div>
          <div className="text-[15px] font-semibold">
            Confirmed · {tx.merchant} {formatMoney(tx.amountMinor, tx.currency)}
          </div>
          <div className="text-xs text-muted">Counted on the leaderboard.</div>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="rise border-b border-line px-4 pt-4 pb-[18px]">
      <div className="flex items-start gap-3">
        {tx.screenshotUrl ? (
          <button type="button" onClick={() => setShowImage((v) => !v)} aria-label="View screenshot" className="hatch h-16 w-16 shrink-0 overflow-hidden rounded-[10px] p-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={tx.screenshotUrl} alt="" className="h-full w-full object-cover" />
          </button>
        ) : applePay ? (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[10px] border border-line bg-surface">
            <Icon name="contactless" size={30} className="text-ink2" />
          </div>
        ) : (
          <div className="hatch flex h-16 w-16 shrink-0 items-end justify-center rounded-[10px] pb-1 font-mono text-[9px] text-muted">no image</div>
        )}
        <div className="min-w-0 flex-1">
          {applePay ? (
            <div className="flex flex-wrap gap-1.5">
              <span className="inline-flex h-6 items-center gap-[5px] rounded-md bg-accent-soft px-2 text-xs font-semibold text-accent">
                <Icon name="contactless" size={14} />
                Apple Pay
              </span>
              {(amountMissing || low) && (
                <span className="inline-flex h-6 items-center gap-[5px] rounded-md bg-warn-soft px-2 text-xs font-semibold text-warn">
                  <Icon name="warning" size={14} fill />
                  {amountMissing ? "Add the amount" : "Check the category"}
                </span>
              )}
            </div>
          ) : (
            <span className={`inline-flex h-6 items-center gap-[5px] rounded-md px-2 text-xs font-semibold ${low ? "bg-warn-soft text-warn" : "bg-accent-soft text-accent"}`}>
              <Icon name={low ? "warning" : "auto_awesome"} size={14} fill />
              {low ? "Check this" : "AI read"} · {confidence}%
            </span>
          )}
          {tx.notes && <div className="mt-1.5 text-xs text-muted">{tx.notes}</div>}
        </div>
      </div>

      {showImage && tx.screenshotUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={tx.screenshotUrl} alt="Screenshot" className="mt-3 w-full rounded-xl border border-line" />
      )}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor={`amount-${tx.id}`}>Amount</label>
          <input id={`amount-${tx.id}`} name="amount" inputMode="decimal" className="field !rounded-[10px] !px-3 font-mono !text-lg" defaultValue={amountMissing ? "" : fromMinor(tx.amountMinor, tx.currency).toFixed(2)} placeholder="0.00" required />
        </div>
        <div>
          <label className="label" htmlFor={`currency-${tx.id}`}>Currency</label>
          <select id={`currency-${tx.id}`} name="currency" className="field !rounded-[10px]" defaultValue={tx.currency}>
            {[...new Set([tx.currency, leagueCurrency, ...CURRENCIES])].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className="label" htmlFor={`merchant-${tx.id}`}>Merchant</label>
          <input id={`merchant-${tx.id}`} name="merchant" className="field !rounded-[10px] !px-3" defaultValue={tx.merchant} required maxLength={80} />
        </div>
        <div>
          <label className="label" htmlFor={`category-${tx.id}`}>Category</label>
          <select id={`category-${tx.id}`} name="category" className="field !rounded-[10px]" defaultValue={tx.category}>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor={`date-${tx.id}`}>Date</label>
          <input id={`date-${tx.id}`} name="occurredOn" type="date" className="field !rounded-[10px]" defaultValue={tx.occurredOn} required />
        </div>
      </div>

      {state && !state.ok && <p className="mt-3 text-sm text-bad">{state.error}</p>}

      <div className="mt-4 flex gap-2">
        <button type="submit" className="btn-primary flex-1" disabled={busy}>
          {pending ? "Saving…" : "Confirm"}
        </button>
        <button
          type="button"
          className="h-[50px] shrink-0 rounded-xl border border-line2 bg-surface px-[18px] text-[15px] font-semibold text-bad"
          disabled={busy}
          onClick={() => startReject(() => rejectTransaction(tx.id))}
        >
          {rejecting ? "…" : "Reject"}
        </button>
      </div>
    </form>
  );
}
