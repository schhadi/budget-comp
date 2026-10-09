import { eq } from "drizzle-orm";
import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/db";
import { leagues } from "@/db/schema";
import { joinByCode } from "@/actions/leagues";
import { GoogleButton } from "@/components/GoogleButton";
import { Icon } from "@/components/Icon";
import { Lockup } from "@/components/Logo";

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const session = await auth();
  const league = await db.query.leagues.findFirst({ where: eq(leagues.inviteCode, code.toUpperCase()) });

  if (!league) {
    return (
      <main className="rise flex flex-1 flex-col justify-center px-7">
        <Icon name="link_off" size={40} className="text-muted" />
        <h1 className="mt-6 text-[26px] leading-[1.15] font-semibold tracking-[-0.02em]">That invite link doesn&apos;t work</h1>
        <p className="mt-2 text-[15px] text-ink2">It may have been reset. Ask your friend for a fresh link or code.</p>
        <Link href="/" className="btn-outline mt-6 self-start !h-11 !px-[18px]">
          Go home
        </Link>
      </main>
    );
  }

  if (session?.user?.id) {
    await joinByCode(code);
  }

  return (
    <main
      className="rise flex flex-1 flex-col px-7"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 72px)", paddingBottom: "calc(env(safe-area-inset-bottom) + 32px)" }}
    >
      <Lockup height={32} className="text-ink" />
      <div className="eyebrow mt-8">You&apos;re invited</div>
      <h1 className="mt-2 text-[34px] leading-[1.08] font-semibold tracking-[-0.025em] text-pretty">Join {league.name}</h1>
      <p className="mt-3.5 text-base leading-normal text-ink2">Sign in with Google and you&apos;re in. Lowest total wins.</p>
      <div className="min-h-10 flex-1" />
      <GoogleButton redirectTo={`/join/${code}`} />
    </main>
  );
}
