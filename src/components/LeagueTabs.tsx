"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";

const TABBED = ["", "/me", "/wrapped", "/members"];

/** Bottom tab bar with the camera button in the centre. Only shown on the four main league screens. */
export function LeagueTabs({ leagueId }: { leagueId: string }) {
  const pathname = usePathname();
  const base = `/leagues/${leagueId}`;
  const active = pathname.startsWith(base) ? pathname.slice(base.length).replace(/\/$/, "") : null;
  if (active === null || !TABBED.includes(active)) return null;

  const tab = (href: string, icon: string, label: string) => {
    const on = active === href;
    return (
      <Link
        href={base + href}
        className={`flex h-[50px] flex-col items-center justify-center gap-[3px] ${on ? "text-accent" : "text-muted"}`}
        aria-current={on ? "page" : undefined}
      >
        <Icon name={icon} size={24} fill={on} />
        <span className="text-[11px] font-semibold">{label}</span>
      </Link>
    );
  };

  return (
    <nav
      className="sticky bottom-0 z-[6] mt-auto grid grid-cols-[1fr_1fr_72px_1fr_1fr] items-end border-t border-line bg-bg px-2 pt-1.5"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 8px)" }}
    >
      {tab("", "leaderboard", "Board")}
      {tab("/me", "person", "Me")}
      <div className="flex h-[50px] items-end justify-center">
        <Link
          href={`${base}/upload`}
          aria-label="Log spending"
          className="mb-1.5 flex h-[60px] w-[60px] items-center justify-center rounded-full bg-accent text-accent-ink"
          style={{ boxShadow: "0 6px 16px var(--camera-shadow)" }}
        >
          <Icon name="photo_camera" size={28} fill />
        </Link>
      </div>
      {tab("/wrapped", "auto_awesome", "Wrapped")}
      {tab("/members", "group", "Members")}
    </nav>
  );
}
