import { Icon } from "./Icon";

/** Full-width notice row that sits between hairline sections. */
export function Flash({ kind, children }: { kind: "ok" | "error" | "info"; children: React.ReactNode }) {
  const { cls, icon } = {
    ok: { cls: "bg-good-soft text-good", icon: "check_circle" },
    error: { cls: "bg-bad-soft text-bad", icon: "error" },
    info: { cls: "bg-accent-soft text-accent", icon: "info" },
  }[kind];
  return (
    <div className={`flex min-h-12 items-center gap-3 border-b border-line px-4 py-3 text-sm font-medium ${cls}`}>
      <Icon name={icon} fill size={20} />
      <span className="flex-1">{children}</span>
    </div>
  );
}
