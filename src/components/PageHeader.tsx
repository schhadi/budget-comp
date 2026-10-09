import { BackButton } from "./BackButton";

/** Top bar for pushed screens: back arrow, title, optional subtitle and trailing slot. */
export function PageHeader({ title, subtitle, back, right }: { title: string; subtitle?: React.ReactNode; back: string; right?: React.ReactNode }) {
  return (
    <header className="topbar flex items-center gap-1 pr-4 pl-2">
      <BackButton fallback={back} />
      <div className="min-w-0 flex-1">
        <div className="text-xl font-semibold tracking-[-0.01em]">{title}</div>
        {subtitle && <div className="text-xs text-muted">{subtitle}</div>}
      </div>
      {right}
    </header>
  );
}

/** Eyebrow label above a hairline list, with optional right-hand note. */
export function SectionHead({ label, right, className = "pt-[26px]", tone }: { label: string; right?: React.ReactNode; className?: string; tone?: "bad" }) {
  return (
    <div className={`flex items-baseline justify-between px-4 pb-2 ${className}`}>
      <span className={`eyebrow ${tone === "bad" ? "!text-bad" : ""}`}>{label}</span>
      {right && <span className="text-xs text-muted">{right}</span>}
    </div>
  );
}
