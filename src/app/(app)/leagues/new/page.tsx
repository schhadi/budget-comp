import Link from "next/link";
import { listFriends } from "@/actions/friends";
import { Avatar } from "@/components/Avatar";
import { CreateLeagueForm } from "@/components/LeagueForms";
import { LeagueSettingsFields } from "@/components/LeagueSettingsFields";
import { PageHeader, SectionHead } from "@/components/PageHeader";
import { requireUser } from "@/lib/session";

export default async function NewLeaguePage() {
  const me = await requireUser();
  const friends = await listFriends(me.id);

  return (
    <div className="rise flex flex-1 flex-col">
      <PageHeader title="New league" back="/dashboard" />
      <CreateLeagueForm>
        <LeagueSettingsFields />
        <SectionHead label="Add friends now" />
        {friends.length === 0 ? (
          <div className="border-t border-line px-4 py-3 text-sm text-muted">
            No friends yet.{" "}
            <Link href="/friends" className="font-semibold text-accent">
              Add some
            </Link>
            , or share the invite link after creating the league.
          </div>
        ) : (
          friends.map((f) => (
            <label key={f.user.id} className="flex min-h-14 items-center gap-3 border-t border-line px-4 py-2.5">
              <input type="checkbox" name={`friend_${f.user.id}`} className="checkbox" defaultChecked />
              <Avatar name={f.user.name} image={f.user.image} size={32} />
              <span className="flex-1 text-[15px]">{f.user.name ?? f.user.email}</span>
            </label>
          ))
        )}
        <div className="border-t border-line" />
      </CreateLeagueForm>
    </div>
  );
}
