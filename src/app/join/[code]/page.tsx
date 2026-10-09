import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { leagues } from "@/db/schema";
import { joinByCode } from "@/actions/leagues";
import { GoogleButton } from "@/components/GoogleButton";

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const session = await auth();
  const league = await db.query.leagues.findFirst({ where: eq(leagues.inviteCode, code.toUpperCase()) });

  if (!league) {
    return (
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="card p-6 text-center max-w-sm">
          <div className="text-4xl">🤷</div>
          <p className="mt-3 font-medium">That invite link doesn&apos;t work.</p>
        </div>
      </main>
    );
  }

  if (session?.user?.id) {
    await joinByCode(code);
  }

  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <div className="card p-6 text-center max-w-sm space-y-4">
        <div className="text-5xl">{league.emoji}</div>
        <h1 className="text-2xl font-bold">Join {league.name}</h1>
        <p className="text-sm text-muted">Sign in with Google and you&apos;re in.</p>
        <GoogleButton redirectTo={`/join/${code}`} />
      </div>
    </main>
  );
}
