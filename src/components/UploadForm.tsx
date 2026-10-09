"use client";

import { upload } from "@vercel/blob/client";
import Link from "next/link";
import { useRef, useState } from "react";
import { registerScreenshot } from "@/actions/transactions";

type Item = {
  id: string;
  name: string;
  preview: string;
  status: "queued" | "uploading" | "reading" | "done" | "error";
  message?: string;
  created?: number;
};

const MAX_EDGE = 1800;

async function downscale(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 2_000_000 && (file.type === "image/jpeg" || file.type === "image/png")) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
    return blob ?? file;
  } catch {
    return file;
  }
}

export function UploadForm({ leagueId }: { leagueId: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const update = (id: string, patch: Partial<Item>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const fresh: Item[] = Array.from(files).map((f) => ({
      id: crypto.randomUUID(),
      name: f.name,
      preview: URL.createObjectURL(f),
      status: "queued",
    }));
    setItems((prev) => [...fresh, ...prev]);
    setBusy(true);

    for (let i = 0; i < fresh.length; i++) {
      const item = fresh[i];
      const file = files[i];
      try {
        update(item.id, { status: "uploading" });
        const blob = await downscale(file);
        const contentType = blob.type || "image/jpeg";
        const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
        const result = await upload(`leagues/${leagueId}/${Date.now()}.${ext}`, blob, {
          access: "public",
          handleUploadUrl: "/api/upload",
          contentType,
          clientPayload: JSON.stringify({ leagueId }),
        });
        const screenshotId = await registerScreenshot(leagueId, {
          url: result.url,
          pathname: result.pathname,
          contentType,
        });
        update(item.id, { status: "reading" });
        const res = await fetch("/api/parse", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ screenshotId }),
        });
        const json = (await res.json()) as { ok: boolean; created?: number; error?: string; isSpending?: boolean; warnings?: string[] };
        if (!res.ok || !json.ok) throw new Error(json.error ?? "Could not read the screenshot");
        const created = json.created ?? 0;
        update(item.id, {
          status: "done",
          created,
          message:
            created === 0
              ? json.isSpending === false
                ? "No spending found in this image."
                : "Nothing extracted. Add it manually below."
              : `${created} ${created === 1 ? "entry" : "entries"} found${json.warnings?.length ? ` · ${json.warnings[0]}` : ""}`,
        });
      } catch (err) {
        update(item.id, { status: "error", message: (err as Error).message });
      }
    }
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  const totalCreated = items.reduce((s, i) => s + (i.created ?? 0), 0);

  return (
    <div className="space-y-4">
      <label
        className={`card block p-6 text-center cursor-pointer border-dashed ${busy ? "opacity-70" : "hover:border-accent"}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          disabled={busy}
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className="text-4xl mb-2">📸</div>
        <div className="font-semibold">Tap to add screenshots</div>
        <div className="text-sm text-muted mt-1">Bank app, receipts, Deliveroo, anything. You can pick several at once.</div>
      </label>

      {items.length > 0 && (
        <ul className="space-y-2">
          {items.map((it) => (
            <li key={it.id} className="card p-3 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={it.preview} alt="" className="w-12 h-12 rounded-lg object-cover bg-card-2" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{it.name}</div>
                <div className={`text-xs ${it.status === "error" ? "text-bad" : "text-muted"}`}>
                  {it.status === "queued" && "Waiting…"}
                  {it.status === "uploading" && "Uploading…"}
                  {it.status === "reading" && "AI is reading it…"}
                  {it.status === "done" && it.message}
                  {it.status === "error" && (it.message ?? "Failed")}
                </div>
              </div>
              <div className="text-lg">
                {it.status === "done" && "✅"}
                {it.status === "error" && "⚠️"}
                {(it.status === "uploading" || it.status === "reading") && <span className="inline-block animate-spin">⏳</span>}
              </div>
            </li>
          ))}
        </ul>
      )}

      {!busy && totalCreated > 0 && (
        <Link href={`/leagues/${leagueId}/review`} className="btn btn-primary w-full">
          Review {totalCreated} {totalCreated === 1 ? "entry" : "entries"} →
        </Link>
      )}
    </div>
  );
}
