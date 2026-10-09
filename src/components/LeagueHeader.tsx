import Link from "next/link";
import type { League, User } from "@/db/schema";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";

/** Top bar for the tabbed league screens: league name (opens the league list), settings, account. */
export function LeagueHeader({ league, user, showSettings = false }: { league: League; user: User; showSettings?: boolean }) {
  return (
    <header className="topbar flex items-center justify-between gap-3 px-4">
      <Link href="/dashboard" className="flex min-h-11 min-w-0 items-center gap-1 text-ink">
        <span className="truncate text-xl font-semibold tracking-[-0.01em]">{league.name}</span>
        <Icon name="expand_more" className="text-muted" />
      </Link>
      <div className="flex shrink-0 items-center gap-1">
        {showSettings && (
          <Link href={`/leagues/${league.id}/settings`} aria-label="League settings" className="icon-btn">
            <Icon name="tune" />
          </Link>
        )}
        <AccountLink user={user} />
      </div>
    </header>
  );
}

export function AccountLink({ user }: { user: User }) {
  return (
    <Link href="/settings" aria-label="Account" className="flex h-11 w-11 items-center justify-center">
      <Avatar name={user.name} image={user.image} size={32} />
    </Link>
  );
}
