"use client";

import { useCallback, useState } from "react";
import { deleteTransaction, resolveChallenge } from "@/actions/transactions";
import { ChallengeForm } from "./ChallengeForm";
import { Icon } from "./Icon";

export interface EntryChallenge {
  id: string;
  by: string;
  reason: string;
}

interface Props {
  txId: string;
  icon: string;
  merchant: string;
  meta: string;
  amount: string;
  shotUrl: string | null;
  challenges: EntryChallenge[];
  /** "board": anyone's entry, may be challenged. "mine": your own entry, may be deleted and challenges resolved. */
  mode: "board" | "mine";
  canChallenge?: boolean;
}

/** A transaction row in a hairline list. Tap to reveal actions. */
export function EntryRow({ txId, icon, merchant, meta, amount, shotUrl, challenges, mode, canChallenge = false }: Props) {
  const [open, setOpen] = useState(false);
  const [challenging, setChallenging] = useState(false);
  const close = useCallback(() => {
    setOpen(false);
    setChallenging(false);
  }, []);
  const expandable = mode === "mine" || !!shotUrl || canChallenge;

  return (
    <div className="border-t border-line">
      <button
        type="button"
        onClick={() => {
          if (!expandable) return;
          setOpen((o) => !o);
          setChallenging(false);
        }}
        className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left"
        aria-expanded={expandable ? open : undefined}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-line bg-surface">
          <Icon name={icon} size={20} className="text-ink2" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-medium">{merchant}</div>
          <div className="mt-px text-xs text-muted">{meta}</div>
        </div>
        <div className="shrink-0 font-mono text-[15px]">{amount}</div>
      </button>

      {mode === "board" &&
        challenges.map((c) => (
          <div key={c.id} className="flex items-start gap-2 pr-4 pb-2.5 pl-16 text-xs text-warn">
            <Icon name="flag" size={16} fill />
            <span>
              Challenged by {c.by}: &ldquo;{c.reason}&rdquo;
            </span>
          </div>
        ))}

      {mode === "mine" &&
        challenges.map((c) => (
          <div key={c.id} className="mr-4 mb-3 ml-16 rounded-[10px] bg-warn-soft px-3 py-2.5 text-[13px]">
            <div className="flex items-start gap-1.5">
              <Icon name="flag" size={16} fill className="mt-0.5 text-warn" />
              <span>
                {c.by} challenged this: &ldquo;{c.reason}&rdquo;
              </span>
            </div>
            <div className="mt-2.5 flex gap-2">
              <form action={resolveChallenge.bind(null, c.id, "dismissed")}>
                <button className="h-9 rounded-lg border border-line2 bg-surface px-3 text-[13px] font-semibold">It&apos;s legit</button>
              </form>
              <form action={resolveChallenge.bind(null, c.id, "upheld")}>
                <button className="h-9 rounded-lg bg-bad-soft px-3 text-[13px] font-semibold text-bad">Fair, remove it</button>
              </form>
            </div>
          </div>
        ))}

      {open && (
        <div className="flex flex-col gap-2 pr-4 pb-3 pl-16">
          <div className="flex gap-2">
            {shotUrl && (
              <a href={shotUrl} target="_blank" rel="noreferrer" className="btn-outline">
                <Icon name="receipt_long" size={18} />
                Screenshot
              </a>
            )}
            {mode === "board" && canChallenge && (
              <button type="button" className="btn-outline" onClick={() => setChallenging(true)}>
                <Icon name="flag" size={18} />
                Challenge
              </button>
            )}
            {mode === "mine" && (
              <form action={deleteTransaction.bind(null, txId)}>
                <button className="btn-outline !text-bad">
                  <Icon name="delete" size={18} />
                  Delete
                </button>
              </form>
            )}
          </div>
          {challenging && <ChallengeForm txId={txId} onDone={close} />}
        </div>
      )}
    </div>
  );
}
