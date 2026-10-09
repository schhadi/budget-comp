import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { friendships, users, type User } from "@/db/schema";
import { listFriends, removeFriend, respondToFriendRequest } from "@/actions/friends";
import { Avatar } from "@/components/Avatar";
import { AddFriendForm } from "@/components/FriendsForms";
import { Icon } from "@/components/Icon";
import { PageHeader, SectionHead } from "@/components/PageHeader";
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
    <div className="rise flex flex-col">
      <PageHeader title="Friends" back="/dashboard" />
      <AddFriendForm />

      {incoming.length > 0 && (
        <>
          <SectionHead label="Requests for you" />
          {incoming.map((r) => (
            <PersonRow key={r.id} user={r.user}>
              <form action={respondToFriendRequest.bind(null, r.id, true)}>
                <button className="h-10 rounded-[10px] bg-accent px-3.5 text-sm font-semibold text-accent-ink">Accept</button>
              </form>
              <form action={respondToFriendRequest.bind(null, r.id, false)}>
                <button aria-label="Ignore" className="flex h-10 w-10 items-center justify-center rounded-[10px] text-muted">
                  <Icon name="close" />
                </button>
              </form>
            </PersonRow>
          ))}
          <div className="border-t border-line" />
        </>
      )}

      <SectionHead label="Your friends" right={String(friends.length)} />
      {friends.length === 0 && <div className="border-t border-line px-4 py-3 text-sm text-muted">No friends yet. Add someone by email above.</div>}
      {friends.map((f) => (
        <PersonRow key={f.friendshipId} user={f.user}>
          <form action={removeFriend.bind(null, f.friendshipId)}>
            <button className="btn-text !text-muted">Remove</button>
          </form>
        </PersonRow>
      ))}
      <div className="border-t border-line" />

      {outgoing.length > 0 && (
        <>
          <SectionHead label="Waiting on them" />
          {outgoing.map((r) => (
            <PersonRow key={r.id} user={r.user} dim>
              <form action={removeFriend.bind(null, r.id)}>
                <button className="btn-text !text-muted">Cancel</button>
              </form>
            </PersonRow>
          ))}
          <div className="border-t border-line" />
        </>
      )}
      <div className="h-10" />
    </div>
  );
}

function PersonRow({ user, dim = false, children }: { user: Pick<User, "name" | "email" | "image">; dim?: boolean; children: React.ReactNode }) {
  return (
    <div className={`flex min-h-[60px] items-center gap-3 border-t border-line py-2.5 pr-2 pl-4 ${dim ? "opacity-75" : ""}`}>
      <Avatar name={user.name} image={user.image} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-medium">{user.name ?? user.email}</div>
        <div className="truncate text-xs text-muted">{user.email}</div>
      </div>
      {children}
    </div>
  );
}
