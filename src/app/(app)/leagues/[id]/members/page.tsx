import { eq } from "drizzle-orm";
import { db } from "@/db";
import { memberships, users } from "@/db/schema";
import { listFriends } from "@/actions/friends";
import { addFriendsToLeague, regenerateInviteCode, removeMember } from "@/actions/leagues";
import { Avatar } from "@/components/Avatar";
import { LeagueHeader } from "@/components/LeagueHeader";
import { SubmitButton } from "@/components/SubmitButton";
import { appUrl } from "@/lib/env";
import { requireMember } from "@/lib/league-access";

export default async function MembersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, league, membership } = await requireMember(id);
  const isOwner = membership.role === "owner";

  const members = await db
    .select({ m: memberships, u: users })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.leagueId, league.id));
  const memberIds = new Set(members.map((x) => x.u.id));
  const friends = (await listFriends(user.id)).filter((f) => !memberIds.has(f.user.id));
  const inviteUrl = `${appUrl()}/join/${league.inviteCode}`;

  return (
    <div className="space-y-6">
      <LeagueHeader league={league} active="/members" isOwner={isOwner} />

      <section className="space-y-2">
        <h2 className="font-semibold">Members ({members.length})</h2>
        {members.map(({ m, u }) => (
          <div key={u.id} className="card p-3 flex items-center gap-3">
            <Avatar name={u.name} image={u.image} />
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{u.name}{u.id === user.id ? " (you)" : ""}</div>
              <div className="text-xs text-muted">{m.role === "owner" ? "👑 Owner" : "Member"}</div>
            </div>
            {m.role !== "owner" && (isOwner || u.id === user.id) && (
              <form action={removeMember.bind(null, league.id, u.id)}>
                <button className="btn btn-ghost btn-sm">{u.id === user.id ? "Leave" : "Remove"}</button>
              </form>
            )}
          </div>
        ))}
      </section>

      <section className="card p-4 space-y-3">
        <div className="font-medium">Add friends</div>
        {friends.length === 0 ? (
          <p className="text-sm text-muted">All your friends are already here, or you haven&apos;t added any yet.</p>
        ) : (
          <form action={addFriendsToLeague.bind(null, league.id)} className="space-y-2">
            {friends.map((f) => (
              <label key={f.user.id} className="flex items-center gap-3 text-sm">
                <input type="checkbox" name={`friend_${f.user.id}`} className="checkbox" />
                <Avatar name={f.user.name} image={f.user.image} size={28} />
                <span>{f.user.name}</span>
              </label>
            ))}
            <SubmitButton className="btn btn-primary btn-sm" pendingText="Adding…">Add selected</SubmitButton>
          </form>
        )}
      </section>

      <section className="card p-4 space-y-2">
        <div className="font-medium">Invite link</div>
        <p className="text-xs text-muted">Anyone with this link can join after signing in with Google.</p>
        <input readOnly className="input font-mono text-sm" value={inviteUrl} />
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">Code: <span className="font-mono tracking-widest">{league.inviteCode}</span></span>
          {isOwner && (
            <form action={regenerateInviteCode.bind(null, league.id)}>
              <button className="btn btn-ghost btn-sm">Reset link</button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
