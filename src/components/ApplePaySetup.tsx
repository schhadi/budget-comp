"use client";

import { useState } from "react";
import { createApplePayKey, revokeApplePayKey } from "@/actions/api-keys";

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

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-secondary btn-sm shrink-0"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // Clipboard blocked (http, old Safari); the text is selectable anyway.
        }
      }}
    >
      {copied ? "Copied ✓" : label}
    </button>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return <code className="font-mono text-xs bg-card-2 border border-border rounded-md px-1.5 py-0.5 break-all">{children}</code>;
}

export function ApplePaySetup({ endpoint, existing, leagues }: { endpoint: string; existing: ExistingKey | null; leagues: LeagueSummary[] }) {
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasKey = !!existing || !!freshKey;

  async function generate(replace: boolean) {
    if (replace && !confirm("Generate a new key? The shortcut on your phone will stop working until you paste the new one in.")) return;
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
    <div className="space-y-6">
      {/* ---- Step 1: key ---- */}
      <section className="card p-4 space-y-3">
        <h2 className="font-semibold">1. Your key</h2>
        {freshKey ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <code className="font-mono text-sm bg-card-2 border border-accent/50 rounded-lg px-3 py-2 flex-1 break-all select-all">{freshKey}</code>
              <CopyButton text={freshKey} />
            </div>
            <p className="text-xs text-warn">Shown once. Copy it into your shortcut now. If you lose it, generate a new one.</p>
          </div>
        ) : existing ? (
          <div className="text-sm">
            <div>
              Key ending in <Mono>…{existing.hint}</Mono>
            </div>
            <div className="text-xs text-muted mt-1">
              Created {new Date(existing.createdAt).toLocaleDateString("en-GB")} ·{" "}
              {existing.lastUsedAt ? `last used ${new Date(existing.lastUsedAt).toLocaleString("en-GB")}` : "never used yet"}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">The shortcut on your phone uses this key to post payments as you. Nobody else should have it.</p>
        )}
        {error && <p className="text-sm text-bad">{error}</p>}
        <div className="flex gap-2 flex-wrap">
          {!hasKey && (
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => generate(false)}>
              {busy ? "Generating…" : "Generate key"}
            </button>
          )}
          {hasKey && !freshKey && (
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => generate(true)}>
              Regenerate
            </button>
          )}
          {hasKey && (
            <button type="button" className="btn btn-danger" disabled={busy} onClick={revoke}>
              Remove key
            </button>
          )}
        </div>
      </section>

      {/* ---- Step 2: build the automation ---- */}
      <section className="card p-4 space-y-3">
        <h2 className="font-semibold">2. Build the automation on your iPhone</h2>
        <p className="text-sm text-muted">Needs iOS 17 or later. Takes about three minutes.</p>
        <ol className="list-decimal pl-5 space-y-2 text-sm">
          <li>
            Open <strong>Shortcuts</strong> → <strong>Automation</strong> tab → <strong>+</strong> (top right).
          </li>
          <li>
            Scroll down and pick <strong>Transaction</strong>. Choose <strong>Any Card or Pass</strong> (or just the cards you spend from), turn on{" "}
            <strong>Run Immediately</strong>, and tap <strong>Next</strong>.
          </li>
          <li>
            Tap <strong>New Blank Automation</strong>. (Picking an existing shortcut here hides the amount field later.)
          </li>
          <li>
            Add the action <strong>Get Contents of URL</strong> and paste this URL:
            <div className="flex items-center gap-2 mt-1">
              <Mono>{endpoint}</Mono>
              <CopyButton text={endpoint} />
            </div>
          </li>
          <li>
            Tap the little arrow on that action to expand it, then set:
            <ul className="list-disc pl-5 mt-1 space-y-1">
              <li>
                <strong>Method</strong>: POST
              </li>
              <li>
                <strong>Headers</strong>: add one. Key <Mono>Authorization</Mono>, value <Mono>Bearer </Mono> followed by your key from step 1
                (there is a space after &ldquo;Bearer&rdquo;).
              </li>
              <li>
                <strong>Request Body</strong>: JSON. Add three text fields. For each value, tap the field, choose{" "}
                <strong>Select Variable</strong> → <strong>Shortcut Input</strong>, then tap the variable and pick the property:
                <div className="mt-1 overflow-x-auto">
                  <table className="text-xs">
                    <thead className="text-muted">
                      <tr>
                        <th className="text-left pr-4 font-medium">Key</th>
                        <th className="text-left font-medium">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="pr-4"><Mono>merchant</Mono></td>
                        <td>Shortcut Input → <strong>Merchant</strong></td>
                      </tr>
                      <tr>
                        <td className="pr-4"><Mono>amount</Mono></td>
                        <td>Shortcut Input → <strong>Amount</strong></td>
                      </tr>
                      <tr>
                        <td className="pr-4"><Mono>card</Mono></td>
                        <td>Shortcut Input → <strong>Card or Pass</strong></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </li>
            </ul>
          </li>
          <li>
            Optional, but nice: add <strong>Get Dictionary Value</strong> (key <Mono>message</Mono> from Contents of URL) and then{" "}
            <strong>Show Notification</strong> with that value, so your phone tells you what got logged.
          </li>
          <li>
            Tap <strong>Done</strong>.
          </li>
        </ol>
      </section>

      {/* ---- Step 3: test ---- */}
      <section className="card p-4 space-y-2">
        <h2 className="font-semibold">3. Test it</h2>
        <p className="text-sm">
          Open the automation and tap the <strong>play</strong> button. With nothing to log you should get{" "}
          <em>&ldquo;Connected as {"<your name>"}&rdquo;</em> back. If you get a 401, the header is wrong: check the key and the space after
          &ldquo;Bearer&rdquo;.
        </p>
        <p className="text-sm">
          Then tap to pay for something. The entry appears on the <strong>Review</strong> tab of{" "}
          {leagues.length === 0 ? (
            <span className="text-warn">every league you join (you&apos;re not in one yet)</span>
          ) : leagues.length === 1 ? (
            <>
              <strong>{leagues[0].emoji} {leagues[0].name}</strong>
            </>
          ) : (
            <>
              all {leagues.length} of your leagues:{" "}
              {leagues.map((l, i) => (
                <span key={l.id}>
                  <strong>{l.emoji} {l.name}</strong>
                  {i < leagues.length - 1 ? ", " : ""}
                </span>
              ))}
            </>
          )}
          . Nothing counts until you confirm it there, same as a screenshot.
        </p>
      </section>

      {/* ---- Caveats ---- */}
      <section className="card p-4 space-y-2">
        <h2 className="font-semibold">Good to know</h2>
        <ul className="list-disc pl-5 space-y-1 text-sm text-muted">
          <li>Only Apple Pay taps and in-app Apple Pay payments trigger it. Physical card taps, bank transfers and direct debits still need a screenshot.</li>
          <li>The amount is what the terminal asked for at the tap. Pre-authorisations (fuel pumps, hotels, TfL daily caps) can differ from what you end up paying, so fix it on Review.</li>
          <li>iOS sometimes sends a blank merchant or a zero amount, and it fires for declined payments too. Those land on Review flagged ⚠️ so you can fill in or reject them.</li>
          <li>The category is a guess from the merchant name. Change it on Review if it&apos;s wrong.</li>
          <li>Sharing your shortcut with a league mate shares your key. They must swap in their own, or their spending gets logged as yours.</li>
        </ul>
      </section>
    </div>
  );
}
