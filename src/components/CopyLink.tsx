"use client";

import { useState } from "react";
import { Icon } from "./Icon";

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex gap-2">
      <div className="flex h-11 min-w-0 flex-1 items-center truncate rounded-[10px] border border-line2 bg-surface px-3 font-mono text-[13px] text-ink2">
        {url.replace(/^https?:\/\//, "")}
      </div>
      <button
        type="button"
        className="flex h-11 shrink-0 items-center gap-1.5 rounded-[10px] bg-accent px-3.5 text-sm font-semibold text-accent-ink"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            // Clipboard blocked; the link is still visible to copy by hand.
          }
        }}
      >
        <Icon name={copied ? "check" : "content_copy"} size={18} />
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
