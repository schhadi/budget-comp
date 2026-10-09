import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { GoogleButton } from "@/components/GoogleButton";
import { Icon } from "@/components/Icon";

const FEATURES = [
  { icon: "photo_camera", title: "Screenshot it.", body: "Bank app, receipt, Deliveroo order. We read the amount, merchant and category." },
  { icon: "leaderboard", title: "Lowest wins.", body: "Weekly or monthly. Exclude rent, add missed-day penalties, set the stake." },
  { icon: "auto_awesome", title: "Wrapped.", body: "A recap every Monday and on the 1st, straight to your inbox." },
];

export default async function Landing() {
  const session = await auth();
  if (session?.user?.id) redirect("/dashboard");

  return (
    <main
      className="rise flex flex-1 flex-col px-7"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 72px)", paddingBottom: "calc(env(safe-area-inset-bottom) + 32px)" }}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-accent text-accent-ink">
        <Icon name="leaderboard" size={28} fill />
      </div>
      <h1 className="mt-7 text-[34px] leading-[1.08] font-semibold tracking-[-0.025em] text-pretty">Who Can Spend the Less?</h1>
      <p className="mt-3.5 text-base leading-normal text-pretty text-ink2">
        A leaderboard for friends who&apos;d rather not be the one buying the first round. Screenshot what you spend, confirm what the AI read, lowest total wins.
      </p>
      <div className="mt-9 flex flex-col gap-3.5">
        {FEATURES.map((f) => (
          <div key={f.title} className="flex items-start gap-3">
            <Icon name={f.icon} className="mt-px text-accent" />
            <div className="text-sm leading-[1.45] text-ink2">
              <strong className="font-semibold text-ink">{f.title}</strong> {f.body}
            </div>
          </div>
        ))}
      </div>
      <div className="min-h-10 flex-1" />
      <GoogleButton />
      <p className="mt-3.5 text-center text-xs text-muted">Leagues are invite-only. You&apos;ll need a link or a code from a friend.</p>
    </main>
  );
}
