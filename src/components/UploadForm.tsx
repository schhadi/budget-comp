"use client";

import { upload } from "@vercel/blob/client";
import Link from "next/link";
import { useRef, useState } from "react";
import { registerScreenshot } from "@/actions/transactions";
import { Icon } from "./Icon";
import { SectionHead } from "./PageHeader";

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

const TONES = {
  primary: "bg-accent text-accent-ink",
  soft: "bg-accent-soft text-accent",
  plain: "bg-surface border border-line2 text-ink2",
  good: "bg-surface border border-line2 text-good",
};

/** One tappable option row on the Log spending screen. */
export function UploadRow({ icon, tone, title, subtitle, chevron = false }: { icon: string; tone: keyof typeof TONES; title: string; subtitle: string; chevron?: boolean }) {
  return (
    <div className="flex min-h-16 items-center gap-3.5 border-t border-line px-4 py-3">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${TONES[tone]}`}>
        <Icon name={icon} fill={tone === "primary"} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-semibold">{title}</div>
        <div className="text-xs text-muted">{subtitle}</div>
      </div>
      {chevron && <Icon name="chevron_right" className="text-muted" />}
    </div>
  );
}

export function UploadForm({ leagueId, children }: { leagueId: string; children?: React.ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

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
                ? "No spending found in this image"
                : "Nothing found. Enter it manually."
              : `${created} ${created === 1 ? "entry" : "entries"} found${json.warnings?.length ? ` · ${json.warnings[0]}` : ""}`,
        });
      } catch (err) {
        update(item.id, { status: "error", message: (err as Error).message });
      }
    }
    setBusy(false);
    if (cameraRef.current) cameraRef.current.value = "";
    if (libraryRef.current) libraryRef.current.value = "";
  }

  const totalCreated = items.reduce((s, i) => s + (i.created ?? 0), 0);

  return (
    <>
      <SectionHead label="Screenshots" className="pt-5" />
      <label className={`block cursor-pointer ${busy ? "pointer-events-none opacity-60" : ""}`}>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" disabled={busy} onChange={(e) => handleFiles(e.target.files)} />
        <UploadRow icon="photo_camera" tone="primary" title="Take a photo" subtitle="A receipt or a card reader" chevron />
      </label>
      <label className={`block cursor-pointer ${busy ? "pointer-events-none opacity-60" : ""}`}>
        <input ref={libraryRef} type="file" accept="image/*" multiple className="hidden" disabled={busy} onChange={(e) => handleFiles(e.target.files)} />
        <UploadRow icon="photo_library" tone="soft" title="Choose screenshots" subtitle="Bank app, Deliveroo, Amazon. Several at once is fine." chevron />
      </label>

      {children}

      {items.length > 0 && (
        <>
          <SectionHead label="Reading" className="pt-[22px]" />
          {items.map((it) => (
            <div key={it.id} className="flex min-h-16 items-center gap-3 border-t border-line px-4 py-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={it.preview} alt="" className="hatch h-11 w-11 shrink-0 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{it.name}</div>
                <div className={`mt-px text-xs ${it.status === "error" ? "text-bad" : it.status === "done" && it.created ? "text-good" : "text-muted"}`}>
                  {it.status === "queued" && "Waiting…"}
                  {it.status === "uploading" && "Uploading…"}
                  {it.status === "reading" && "AI is reading it…"}
                  {it.status === "done" && it.message}
                  {it.status === "error" && (it.message ?? "Failed")}
                </div>
              </div>
              {(it.status === "queued" || it.status === "uploading" || it.status === "reading") && <div className="spinner" />}
              {it.status === "done" && <Icon name={it.created ? "check_circle" : "help"} fill className={it.created ? "text-good" : "text-muted"} />}
              {it.status === "error" && <Icon name="error" fill className="text-bad" />}
            </div>
          ))}
          {!busy && totalCreated > 0 && (
            <div className="border-t border-line px-4 pt-4">
              <Link href={`/leagues/${leagueId}/review`} className="btn-primary">
                Review {totalCreated} {totalCreated === 1 ? "entry" : "entries"}
                <Icon name="arrow_forward" size={20} />
              </Link>
            </div>
          )}
        </>
      )}
    </>
  );
}
