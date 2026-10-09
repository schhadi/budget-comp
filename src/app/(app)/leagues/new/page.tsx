import Link from "next/link";
import { listFriends } from "@/actions/friends";
import { Avatar } from "@/components/Avatar";
import { CreateLeagueForm } from "@/components/LeagueForms";
import { LeagueSettingsFields } from "@/components/LeagueSettingsFields";
import { requireUser } from "@/lib/session";

export default async function NewLeaguePage() {
  const me = await requireUser();
  const friends = await listFriends(me.id);

  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="text-2xl font-bold">New league</h1>
      <CreateLeagueForm>
        <div className="card p-4">
          <LeagueSettingsFields />
        </div>
        <div className="card p-4 space-y-3">
          <div className="font-medium">Add friends now</div>
          {friends.length === 0 ? (
            <p className="text-sm text-muted">
              No friends yet. <Link href="/friends" className="text-accent underline">Add some</Link>, or share the invite link after creating the league.
            </p>
          ) : (
            <div className="space-y-2">
              {friends.map((f) => (
                <label key={f.user.id} className="flex items-center gap-3 text-sm">
                  <input type="checkbox" name={`friend_${f.user.id}`} className="checkbox" defaultChecked />
                  <Avatar name={f.user.name} image={f.user.image} size={28} />
                  <span>{f.user.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </CreateLeagueForm>
    </div>
  );
}
