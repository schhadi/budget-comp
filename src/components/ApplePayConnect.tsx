"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { revokeApplePayKey } from "@/actions/api-keys";
import type { ShortcutInputMode } from "@/lib/env";
import { Icon } from "./Icon";
import { SectionHead } from "./PageHeader";

export interface ConnectionStatus {
  /** Device name sent by the phone when it paired, or "Set up by hand". */
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
}

interface LeagueSummary {
  id: string;
  name: string;
  emoji: string;
  currency: string;
}

const subscribeNoop = () => () => {};
const isIphone = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

function Step({ n, title, done, children }: { n: number; title: string; done?: boolean; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 px-4">
      <div
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold ${done ? "bg-good text-white" : "bg-accent-soft text-accent"}`}
        aria-label={done ? `Step ${n}, done` : `Step ${n}`}
      >
        {done ? <Icon name="check" size={18} /> : n}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2 pb-6">
        <div className="pt-1 text-[16px] font-semibold">{title}</div>
        {children}
      </div>
    </li>
  );
}

function B({ children }: { children: React.ReactNode }) {
  return <strong className="text-ink">{children}</strong>;
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay ? d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/**
 * One-tap Apple Pay setup: add the shared shortcut, tap Connect (the shortcut fetches and keeps
 * its own key), then turn on the Wallet automation. Nothing to copy or paste.
 */
export function ApplePayConnect({
  shortcutUrl,
  shortcutName,
  inputMode,
  connectUrl,
  status,
  leagues,
}: {
  shortcutUrl: string;
  shortcutName: string;
  inputMode: ShortcutInputMode;
  connectUrl: string;
  status: ConnectionStatus | null;
  leagues: LeagueSummary[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const onIphone = useSyncExternalStore(subscribeNoop, isIphone, () => null);

  // Pairing happens over in the Shortcuts app. Refresh when the person comes back so the status row updates.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router]);

  async function disconnect() {
    if (!confirm("Disconnect? Your iPhone stops logging Apple Pay taps until you connect it again.")) return;
    setBusy(true);
    await revokeApplePayKey();
    setBusy(false);
    router.refresh();
  }

  const connected = !!status;

  return (
    <>
      {connected ? (
        <div className="mx-4 mt-5 flex items-center gap-3 rounded-[12px] border border-good bg-good-soft px-3 py-3">
          <Icon name="check_circle" fill size={26} className="text-good" />
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold text-good">Connected</div>
            <div className="mt-px text-xs text-ink2">
              {status.label} · since {formatWhen(status.createdAt)} · {status.lastUsedAt ? `last tap ${formatWhen(status.lastUsedAt)}` : "no taps logged yet"}
            </div>
          </div>
        </div>
      ) : (
        <p className="px-4 pt-5 text-[15px] leading-snug text-ink2">
          Two taps on your iPhone, then one automation. No keys to copy.
        </p>
      )}

      {onIphone === false && (
        <div className="mx-4 mt-4 flex items-start gap-2.5 rounded-[12px] bg-accent-soft px-3 py-2.5 text-[13px] text-accent">
          <Icon name="phone_iphone" size={18} className="mt-px" />
          <span>Open this page on your iPhone. Both buttons below open the Shortcuts app there.</span>
        </div>
      )}

      <SectionHead label={connected ? "Set up again on another iPhone" : "Set up"} className="pt-[26px]" right="iOS 17 or later" />
      <ol className="flex flex-col">
        <Step n={1} title="Get the shortcut" done={connected}>
          <a href={shortcutUrl} target="_blank" rel="noopener noreferrer" className={connected ? "btn-outline w-full !h-12" : "btn-primary"}>
            <Icon name="download" size={20} />
            Get the shortcut
          </a>
          <p className="text-[13px] leading-snug text-muted">
            Safari shows a preview. Tap <B>Add Shortcut</B>. It&apos;s the same shortcut for everyone and holds nothing of yours yet.
          </p>
        </Step>

        <Step n={2} title={connected ? "Reconnect this iPhone" : "Connect this iPhone"} done={connected}>
          <a href={connectUrl} className={connected ? "btn-outline w-full !h-12" : "btn-primary"}>
            <Icon name="link" size={20} />
            {connected ? "Reconnect this iPhone" : "Connect this iPhone"}
          </a>
          <p className="text-[13px] leading-snug text-muted">
            Shortcuts opens, fetches a key for you, keeps it on the phone and says <em>Connected as …</em>. Then come back here. The link works for 15 minutes; reload
            the page for a fresh one.
          </p>
        </Step>

        <Step n={3} title="Turn on the automation">
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-[14px] leading-snug text-ink2">
            <li>
              Shortcuts app → <B>Automation</B> tab → <B>+</B>.
            </li>
            <li>
              Pick <B>Wallet</B> (called <B>Transaction</B> on iOS 17 and 18). Leave <B>Any Card or Pass</B>, choose <B>Run Immediately</B>, tap <B>Next</B>.
            </li>
            {inputMode === "transaction" ? (
              <li>
                Choose <B>{shortcutName}</B> from your shortcuts, then <B>Done</B>.
              </li>
            ) : (
              <>
                <li>
                  Tap <B>New Blank Automation</B>.
                </li>
                <li>
                  Add a <B>Text</B> action. Put three variables in it, one per line: tap <B>Select Variable</B> → <B>Shortcut Input</B>, tap the blue token and pick{" "}
                  <B>Merchant</B>. New line, same again for <B>Amount</B>, then <B>Card or Pass</B>.
                </li>
                <li>
                  Add a <B>Run Shortcut</B> action and choose <B>{shortcutName}</B>. Its input fills in with the Text (if not, tap <B>Input</B> and choose{" "}
                  <B>Text</B>).
                </li>
                <li>
                  Tap <B>Done</B>.
                </li>
              </>
            )}
          </ol>
        </Step>

        <Step n={4} title="Tap to pay">
          <p className="text-[14px] leading-snug text-ink2">
            Your phone shows a notification with what got logged, and it appears on the <B>Review</B> tab of{" "}
            {leagues.length === 0 ? (
              <span className="text-warn">every league you join (you&apos;re not in one yet)</span>
            ) : leagues.length === 1 ? (
              <B>
                {leagues[0].emoji} {leagues[0].name}
              </B>
            ) : (
              <>
                all {leagues.length} of your leagues:{" "}
                {leagues.map((l, i) => (
                  <span key={l.id}>
                    <B>
                      {l.emoji} {l.name}
                    </B>
                    {i < leagues.length - 1 ? ", " : ""}
                  </span>
                ))}
              </>
            )}
            . Nothing counts until you confirm it there, same as a screenshot.
          </p>
        </Step>
      </ol>

      {connected && (
        <div className="px-4">
          <button type="button" className="btn-outline w-full !h-12 !text-bad" disabled={busy} onClick={disconnect}>
            <Icon name="link_off" size={18} />
            {busy ? "Disconnecting…" : "Disconnect this iPhone"}
          </button>
        </div>
      )}

      <SectionHead label="Good to know" className="pt-[30px]" />
      <ul className="flex list-disc flex-col gap-2 pr-4 pl-9 text-[13px] leading-snug text-muted">
        <li>Only Apple Pay taps and in-app Apple Pay payments trigger it. Physical card taps, bank transfers and direct debits still need a screenshot.</li>
        <li>The amount is what the terminal asked for at the tap. Fuel pumps, hotels and TfL daily caps can settle differently, so fix it on Review.</li>
        <li>iOS sometimes sends a blank merchant or a zero amount, and it fires for declined payments too. Those land on Review flagged so you can fill in or reject them.</li>
        <li>The category is a guess from the merchant name. Change it on Review if it&apos;s wrong.</li>
        <li>Your key lives in a small file in iCloud Drive → Shortcuts, not inside the shortcut, so passing the shortcut on to a league mate is safe.</li>
        <li>Nothing logging? Settings → Mobile Data must be on for Wallet, and the shortcut needs to be run once by hand from the Shortcuts app so iOS trusts its network access.</li>
      </ul>
    </>
  );
}
