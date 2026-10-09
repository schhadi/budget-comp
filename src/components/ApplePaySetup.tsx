"use client";

import { useState } from "react";
import { createApplePayKey, revokeApplePayKey } from "@/actions/api-keys";
import { Icon } from "./Icon";
import { SectionHead } from "./PageHeader";

interface ExistingKey {
  hint: string;
  createdAt: string;
  lastUsedAt: string | null;
}

interface LeagueSummary {
  id: string;
  name: string;
  emoji: string;
  currency: string;
}

/** Mono value with a copy button, wrapping so a long key or URL stays fully visible. */
function CopyField({ value, accent = false }: { value: string; accent?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex gap-2">
      <div className={`min-w-0 flex-1 rounded-[10px] border bg-surface px-3 py-2.5 font-mono text-[13px] break-all text-ink2 select-all ${accent ? "border-accent" : "border-line2"}`}>
        {value}
      </div>
      <button
        type="button"
        className="flex h-11 shrink-0 items-center gap-1.5 self-start rounded-[10px] bg-accent px-3.5 text-sm font-semibold text-accent-ink"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            // Clipboard blocked; the value is still selectable.
          }
        }}
      >
        <Icon name={copied ? "check" : "content_copy"} size={18} />
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded-md border border-line bg-surface px-1.5 py-0.5 font-mono text-[12px] text-ink2">{children}</code>;
}

export function ApplePaySetup({ endpoint, existing, leagues }: { endpoint: string; existing: ExistingKey | null; leagues: LeagueSummary[] }) {
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasKey = !!existing || !!freshKey;

  async function generate(replace: boolean) {
    if (replace && !confirm("Generate a new key? The shortcut on your phone stops working until you paste the new one in.")) return;
    setBusy(true);
    setError(null);
    const result = await createApplePayKey();
    setBusy(false);
    if (result.ok) setFreshKey(result.key);
    else setError(result.error);
  }

  async function revoke() {
    if (!confirm("Remove the key? Your shortcut will stop logging payments.")) return;
    setBusy(true);
    await revokeApplePayKey();
    setFreshKey(null);
    setBusy(false);
  }

  return (
    <>
      {/* ---- 1. Key ---- */}
      <SectionHead label="1 · Your key" className="pt-[22px]" />
      <div className="flex flex-col gap-3 px-4">
        {freshKey ? (
          <>
            <CopyField value={freshKey} accent />
            <div className="flex items-start gap-1.5 text-xs text-warn">
              <Icon name="warning" size={16} fill className="mt-px" />
              <span>Shown once. Paste it into your shortcut now. If you lose it, generate a new one.</span>
            </div>
          </>
        ) : existing ? (
          <div className="flex items-center gap-3 rounded-[10px] border border-line bg-surface px-3 py-3">
            <Icon name="key" size={22} className="text-ink2" />
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-medium">
                Key ending in <span className="font-mono">…{existing.hint}</span>
              </div>
              <div className="mt-px text-xs text-muted">
                Created {new Date(existing.createdAt).toLocaleDateString("en-GB")} ·{" "}
                {existing.lastUsedAt ? `last used ${new Date(existing.lastUsedAt).toLocaleString("en-GB")}` : "not used yet"}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-ink2">The shortcut on your phone uses this key to log payments as you. Nobody else should have it.</p>
        )}
        {error && <p className="text-sm text-bad">{error}</p>}
        {!hasKey && (
          <button type="button" className="btn-primary" disabled={busy} onClick={() => generate(false)}>
            <Icon name="key" size={20} />
            {busy ? "Generating…" : "Generate key"}
          </button>
        )}
        {hasKey && (
          <div className="flex gap-2">
            {!freshKey && (
              <button type="button" className="btn-outline flex-1" disabled={busy} onClick={() => generate(true)}>
                <Icon name="autorenew" size={18} />
                Regenerate
              </button>
            )}
            <button type="button" className="btn-outline flex-1 !text-bad" disabled={busy} onClick={revoke}>
              <Icon name="delete" size={18} />
              Remove key
            </button>
          </div>
        )}
      </div>

      {/* ---- 2. Automation ---- */}
      <SectionHead label="2 · Build the automation" className="pt-[30px]" right="iOS 17 or later" />
      <ol className="flex list-decimal flex-col gap-3 pr-4 pl-9 text-[14px] leading-snug text-ink2">
        <li>
          Open <strong className="text-ink">Shortcuts</strong> → <strong className="text-ink">Automation</strong> tab → <strong className="text-ink">+</strong> in the top right.
        </li>
        <li>
          Scroll down and pick <strong className="text-ink">Transaction</strong>. Choose <strong className="text-ink">Any Card or Pass</strong> (or just the cards you spend from), turn on{" "}
          <strong className="text-ink">Run Immediately</strong>, then <strong className="text-ink">Next</strong>.
        </li>
        <li>
          Tap <strong className="text-ink">New Blank Automation</strong>. Picking an existing shortcut here hides the amount field later.
        </li>
        <li>
          Add the action <strong className="text-ink">Get Contents of URL</strong> and paste this URL:
          <div className="mt-2">
            <CopyField value={endpoint} />
          </div>
        </li>
        <li>
          Tap the small arrow on that action to expand it, then set:
          <ul className="mt-1.5 flex list-disc flex-col gap-1.5 pl-4">
            <li>
              <strong className="text-ink">Method</strong>: POST
            </li>
            <li>
              <strong className="text-ink">Headers</strong>: add one. Key <Code>Authorization</Code>, value <Code>Bearer </Code> followed by your key from step 1. There is a space after
              &ldquo;Bearer&rdquo;.
            </li>
            <li>
              <strong className="text-ink">Request Body</strong>: JSON. Add three text fields. For each value tap the field, choose <strong className="text-ink">Select Variable</strong> →{" "}
              <strong className="text-ink">Shortcut Input</strong>, then tap the variable and pick the property:
              <table className="mt-2 w-full text-[13px]">
                <thead>
                  <tr className="eyebrow !text-[11px]">
                    <th className="pb-1 text-left font-semibold">Key</th>
                    <th className="pb-1 text-left font-semibold">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["merchant", "Merchant"],
                    ["amount", "Amount"],
                    ["card", "Card or Pass"],
                  ].map(([key, prop]) => (
                    <tr key={key} className="border-t border-line">
                      <td className="py-1.5 pr-3">
                        <Code>{key}</Code>
                      </td>
                      <td className="py-1.5">
                        Shortcut Input → <strong className="text-ink">{prop}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </li>
          </ul>
        </li>
        <li>
          Optional: add <strong className="text-ink">Get Dictionary Value</strong> for key <Code>message</Code> from Contents of URL, then{" "}
          <strong className="text-ink">Show Notification</strong> with it, so your phone tells you what got logged.
        </li>
        <li>
          Tap <strong className="text-ink">Done</strong>.
        </li>
      </ol>

      {/* ---- 3. Test ---- */}
      <SectionHead label="3 · Test it" className="pt-[30px]" />
      <div className="flex flex-col gap-2.5 px-4 text-[14px] leading-snug text-ink2">
        <p>
          Open the automation and tap the <strong className="text-ink">play</strong> button. With nothing to log you get back <em>&ldquo;Connected as …&rdquo;</em>. A 401 means the header is wrong:
          check the key and the space after &ldquo;Bearer&rdquo;.
        </p>
        <p>
          Then tap to pay for something. It appears on the <strong className="text-ink">Review</strong> tab of{" "}
          {leagues.length === 0 ? (
            <span className="text-warn">every league you join (you&apos;re not in one yet)</span>
          ) : leagues.length === 1 ? (
            <strong className="text-ink">
              {leagues[0].emoji} {leagues[0].name}
            </strong>
          ) : (
            <>
              all {leagues.length} of your leagues:{" "}
              {leagues.map((l, i) => (
                <span key={l.id}>
                  <strong className="text-ink">
                    {l.emoji} {l.name}
                  </strong>
                  {i < leagues.length - 1 ? ", " : ""}
                </span>
              ))}
            </>
          )}
          . Nothing counts until you confirm it there, same as a screenshot.
        </p>
      </div>

      {/* ---- Caveats ---- */}
      <SectionHead label="Good to know" className="pt-[30px]" />
      <ul className="flex list-disc flex-col gap-2 pr-4 pl-9 text-[13px] leading-snug text-muted">
        <li>Only Apple Pay taps and in-app Apple Pay payments trigger it. Physical card taps, bank transfers and direct debits still need a screenshot.</li>
        <li>The amount is what the terminal asked for at the tap. Fuel pumps, hotels and TfL daily caps can settle differently, so fix it on Review.</li>
        <li>iOS sometimes sends a blank merchant or a zero amount, and it fires for declined payments too. Those land on Review flagged so you can fill in or reject them.</li>
        <li>The category is a guess from the merchant name. Change it on Review if it&apos;s wrong.</li>
        <li>Sharing your shortcut with a league mate shares your key. They must swap in their own, or their spending is logged as yours.</li>
      </ul>
    </>
  );
}
