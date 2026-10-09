import Link from "next/link";
import { signOut } from "@/auth";
import type { User } from "@/db/schema";
import { Avatar } from "./Avatar";

export function Nav({ user }: { user: User }) {
  return (
    <header className="sticky top-0 z-20 backdrop-blur bg-background/80 border-b border-border">
      <div className="mx-auto max-w-3xl px-4 h-14 flex items-center justify-between gap-3">
        <Link href="/dashboard" className="font-bold tracking-tight text-base sm:text-lg">
          <span className="text-accent">Who</span> Can Spend the Less?
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/dashboard" className="btn btn-ghost btn-sm">Leagues</Link>
          <Link href="/friends" className="btn btn-ghost btn-sm">Friends</Link>
          <Link href="/settings" className="flex items-center" aria-label="Settings">
            <Avatar name={user.name} image={user.image} size={30} />
          </Link>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <button className="btn btn-ghost btn-sm hidden sm:inline-flex" type="submit">Sign out</button>
          </form>
        </nav>
      </div>
    </header>
  );
}
