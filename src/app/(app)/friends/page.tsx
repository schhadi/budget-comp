import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { friendships, users } from "@/db/schema";
import { listFriends, removeFriend, respondToFriendRequest } from "@/actions/friends";
import { Avatar } from "@/components/Avatar";
import { AddFriendForm } from "@/components/FriendsForms";
import { requireUser } from "@/lib/session";

export default async function FriendsPage() {
  const me = await requireUser();
  const friends = await listFriends(me.id);
  const incoming = await db
    .select({ id: friendships.id, user: users })
    .from(friendships)
    .innerJoin(users, eq(users.id, friendships.requesterId))
    .where(and(eq(friendships.addresseeId, me.id), eq(friendships.status, "pending")));
  const outgoing = await db
    .select({ id: friendships.id, user: users })
    .from(friendships)
    .innerJoin(users, eq(users.id, friendships.addresseeId))
    .where(and(eq(friendships.requesterId, me.id), eq(friendships.status, "pending")));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Friends</h1>

      <section className="card p-4 space-y-3">
        <div className="font-medium">Add a friend by email</div>
        <AddFriendForm />
      </section>

      {incoming.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold">Requests for you</h2>
          {incoming.map((r) => (
            <div key={r.id} className="card p-3 flex items-center gap-3">
              <Avatar name={r.user.name} image={r.user.image} />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{r.user.name}</div>
                <div className="text-xs text-muted truncate">{r.user.email}</div>
              </div>
              <form action={respondToFriendRequest.bind(null, r.id, true)}><button className="btn btn-primary btn-sm">Accept</button></form>
              <form action={respondToFriendRequest.bind(null, r.id, false)}><button className="btn btn-ghost btn-sm">Ignore</button></form>
            </div>
          ))}
        </section>
      )}

      <section className="space-y-2">
        <h2 className="font-semibold">Your friends ({friends.length})</h2>
        {friends.length === 0 && <p className="text-sm text-muted">No friends yet. Add someone above.</p>}
        {friends.map((f) => (
          <div key={f.friendshipId} className="card p-3 flex items-center gap-3">
            <Avatar name={f.user.name} image={f.user.image} />
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{f.user.name}</div>
              <div className="text-xs text-muted truncate">{f.user.email}</div>
            </div>
            <form action={removeFriend.bind(null, f.friendshipId)}><button className="btn btn-ghost btn-sm">Remove</button></form>
          </div>
        ))}
      </section>

      {outgoing.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold text-muted">Waiting on them</h2>
          {outgoing.map((r) => (
            <div key={r.id} className="card p-3 flex items-center gap-3 opacity-80">
              <Avatar name={r.user.name} image={r.user.image} />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{r.user.name}</div>
                <div className="text-xs text-muted truncate">{r.user.email}</div>
              </div>
              <form action={removeFriend.bind(null, r.id)}><button className="btn btn-ghost btn-sm">Cancel</button></form>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
