import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { GoogleButton } from "@/components/GoogleButton";

export default async function Landing() {
  const session = await auth();
  if (session?.user?.id) redirect("/dashboard");

  return (
    <main className="flex-1 flex flex-col">
      <section className="mx-auto max-w-3xl px-4 pt-20 pb-12 text-center">
        <div className="text-6xl mb-6">🏆</div>
        <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-[1.05]">
          Who Can Spend <span className="text-accent">the Less?</span>
        </h1>
        <p className="mt-5 text-lg text-muted max-w-xl mx-auto">
          A leaderboard for uni friends. Screenshot what you spend, let the AI read it, and find out who&apos;s actually the most broke-proof.
        </p>
        <div className="mt-8 flex justify-center">
          <GoogleButton />
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-20 grid sm:grid-cols-3 gap-4">
        {[
          { e: "📸", t: "Screenshot it", d: "Bank app, receipt, Deliveroo order. Upload daily, we read the amount, merchant and category." },
          { e: "🥇", t: "Lowest wins", d: "Weekly or monthly leaderboards. Exclude rent, add missed-day penalties, set the stake." },
          { e: "✨", t: "Weekly Wrapped", d: "A Spotify-style recap every week and month, straight to your inbox. Cheeky by design." },
        ].map((f) => (
          <div key={f.t} className="card p-5">
            <div className="text-3xl">{f.e}</div>
            <div className="font-semibold mt-3">{f.t}</div>
            <div className="text-sm text-muted mt-1">{f.d}</div>
          </div>
        ))}
      </section>
    </main>
  );
}
