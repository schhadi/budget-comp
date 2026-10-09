import { count, eq } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { memberships } from "@/db/schema";
import { listFriends } from "@/actions/friends";
import { signOut } from "@/auth";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { NotificationPrefs } from "@/components/NotificationPrefs";
import { PageHeader, SectionHead } from "@/components/PageHeader";
import { requireUser } from "@/lib/session";

export default async function SettingsPage() {
  const me = await requireUser();
  const friends = await listFriends(me.id);
  const [{ leagueCount }] = await db.select({ leagueCount: count() }).from(memberships).where(eq(memberships.userId, me.id));

  return (
    <div className="rise flex flex-col">
      <PageHeader title="Account" back="/dashboard" />
      <div className="flex items-center gap-3.5 border-b border-line px-4 py-5">
        <Avatar name={me.name} image={me.image} size={52} />
        <div className="min-w-0">
          <div className="truncate text-[17px] font-semibold">{me.name}</div>
          <div className="truncate text-[13px] text-muted">{me.email} · Google</div>
        </div>
      </div>

      <SectionHead label="Email notifications" className="pt-[22px]" />
      <NotificationPrefs reminderEmails={me.reminderEmails} recapEmails={me.recapEmails} />

      <SectionHead label="People" className="pt-[22px]" />
      <NavRow href="/friends" icon="group" label="Friends" count={friends.length} />
      <NavRow href="/dashboard" icon="emoji_events" label="Your leagues" count={leagueCount} last />

      <form
        className="px-4 pt-7"
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
      >
        <button className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-line2 bg-surface text-[15px] font-semibold">
          <Icon name="logout" size={20} />
          Sign out
        </button>
      </form>
      <div className="p-4 text-center text-xs text-muted">Who Can Spend the Less? · v0.1</div>
    </div>
  );
}

function NavRow({ href, icon, label, count, last = false }: { href: string; icon: string; label: string; count: number; last?: boolean }) {
  return (
    <Link href={href} className={`flex min-h-14 items-center gap-3 border-t border-line px-4 py-3 ${last ? "border-b" : ""}`}>
      <Icon name={icon} className="text-ink2" />
      <span className="flex-1 text-[15px] font-medium">{label}</span>
      <span className="text-[13px] text-muted">{count}</span>
      <Icon name="chevron_right" className="text-muted" />
    </Link>
  );
}
