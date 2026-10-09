export function Flash({ kind, children }: { kind: "ok" | "error" | "info"; children: React.ReactNode }) {
  const styles = {
    ok: "border-good/40 bg-good/10 text-good",
    error: "border-bad/40 bg-bad/10 text-bad",
    info: "border-accent/40 bg-accent/10 text-foreground",
  }[kind];
  return <div className={`rounded-xl border px-3 py-2 text-sm ${styles}`}>{children}</div>;
}
