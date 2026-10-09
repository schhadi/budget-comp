import Link from "next/link";

const tabs = [
  { href: "", label: "Board" },
  { href: "/upload", label: "Upload" },
  { href: "/review", label: "Review" },
  { href: "/me", label: "Me" },
  { href: "/wrapped", label: "Wrapped" },
  { href: "/members", label: "Members" },
];

export function LeagueTabs({ leagueId, active, pendingCount }: { leagueId: string; active: string; pendingCount?: number }) {
  return (
    <div className="flex gap-1 overflow-x-auto -mx-4 px-4 pb-1 no-scrollbar">
      {tabs.map((t) => {
        const isActive = active === t.href;
        return (
          <Link
            key={t.href}
            href={`/leagues/${leagueId}${t.href}`}
            className={`btn btn-sm ${isActive ? "btn-primary" : "btn-secondary"} relative`}
          >
            {t.label}
            {t.href === "/review" && pendingCount ? (
              <span className="ml-1 rounded-full bg-bad text-white text-[10px] px-1.5 py-0.5 leading-none">{pendingCount}</span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
