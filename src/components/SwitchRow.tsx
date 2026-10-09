/** Settings row with a title, optional subtitle and a switch backed by a form checkbox. */
export function SwitchRow({ name, title, subtitle, defaultChecked, last = false }: { name: string; title: string; subtitle?: string; defaultChecked: boolean; last?: boolean }) {
  return (
    <label className={`flex cursor-pointer items-center gap-3 border-t border-line px-4 py-3 ${subtitle ? "min-h-16" : "min-h-14"} ${last ? "border-b" : ""}`}>
      <div className="flex-1">
        <div className="text-[15px] font-medium">{title}</div>
        {subtitle && <div className="mt-px text-xs text-muted">{subtitle}</div>}
      </div>
      <input type="checkbox" role="switch" name={name} className="switch" defaultChecked={defaultChecked} />
    </label>
  );
}
