import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { memberships, users } from "@/db/schema";
import { listFriends } from "@/actions/friends";
import { addFriendsToLeague, regenerateInviteCode, removeMember } from "@/actions/leagues";
import { Avatar } from "@/components/Avatar";
import { CopyLink } from "@/components/CopyLink";
import { LeagueHeader } from "@/components/LeagueHeader";
import { SectionHead } from "@/components/PageHeader";
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
    .where(eq(memberships.leagueId, league.id))
    .orderBy(asc(memberships.joinedAt));
  members.sort((a, b) => (a.m.role === "owner" ? -1 : b.m.role === "owner" ? 1 : 0));
  const memberIds = new Set(members.map((x) => x.u.id));
  const friends = (await listFriends(user.id)).filter((f) => !memberIds.has(f.user.id));
  const inviteUrl = `${appUrl()}/join/${league.inviteCode}`;
  const joined = (d: Date) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(d);

  return (
    <div className="rise flex flex-col">
      <LeagueHeader league={league} user={user} />

      <SectionHead label="Members" right={`${members.length} ${members.length === 1 ? "person" : "people"}`} className="pt-5" />
      {members.map(({ m, u }) => {
        const isMe = u.id === user.id;
        const action = m.role !== "owner" && (isOwner || isMe) ? (isMe ? "Leave" : "Remove") : null;
        return (
          <div key={u.id} className="flex min-h-[60px] items-center gap-3 border-t border-line py-2.5 pr-2 pl-4">
            <Avatar name={u.name} image={u.image} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[15px] font-medium">
                <span className="truncate">{u.name ?? u.email}</span>
                {isMe && <span className="rounded bg-accent-soft px-[5px] py-px text-[11px] font-semibold tracking-[0.04em] text-accent">YOU</span>}
              </div>
              <div className="mt-px text-xs text-muted">{m.role === "owner" ? "Owner" : `Member · joined ${joined(m.joinedAt)}`}</div>
            </div>
            {action && (
              <form action={removeMember.bind(null, league.id, u.id)}>
                <button className="btn-text">{action}</button>
              </form>
            )}
          </div>
        );
      })}

      <div className="border-t border-line" />
      <SectionHead label="Add friends" />
      {friends.length === 0 ? (
        <div className="border-t border-line px-4 py-3 text-sm text-muted">All your friends are already here, or you haven&apos;t added any yet.</div>
      ) : (
        <form action={addFriendsToLeague.bind(null, league.id)}>
          {friends.map((f) => (
            <label key={f.user.id} className="flex min-h-14 items-center gap-3 border-t border-line px-4 py-2.5">
              <input type="checkbox" name={`friend_${f.user.id}`} className="checkbox" />
              <Avatar name={f.user.name} image={f.user.image} size={32} />
              <span className="flex-1 text-[15px]">{f.user.name ?? f.user.email}</span>
            </label>
          ))}
          <div className="border-t border-line px-4 pt-3">
            <SubmitButton className="btn-outline !h-11 !px-4" pendingText="Adding…">
              Add selected
            </SubmitButton>
          </div>
        </form>
      )}

      <SectionHead label="Invite link" right={<>Code <span className="font-mono tracking-[0.08em]">{league.inviteCode}</span></>} />
      <div className="flex flex-col gap-2.5 border-t border-line px-4 pt-3">
        <CopyLink url={inviteUrl} />
        <div className="flex items-center justify-between gap-3 text-xs text-muted">
          <span>Anyone with the link can join after signing in with Google.</span>
          {isOwner && (
            <form action={regenerateInviteCode.bind(null, league.id)}>
              <button className="h-9 shrink-0 px-2 text-[13px] font-semibold text-accent">Reset link</button>
            </form>
          )}
        </div>
      </div>
      <div className="h-8" />
    </div>
  );
}
