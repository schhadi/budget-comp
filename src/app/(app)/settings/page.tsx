import { eq } from "drizzle-orm";
import Link from "next/link";
import { updateNotificationPrefs } from "@/actions/leagues";
import { signOut } from "@/auth";
import { Avatar } from "@/components/Avatar";
import { SubmitButton } from "@/components/SubmitButton";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { requireUser } from "@/lib/session";

export default async function SettingsPage() {
  const me = await requireUser();
  const applePayKey = await db.query.apiKeys.findFirst({ where: eq(apiKeys.userId, me.id) });
  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="text-2xl font-bold">Settings</h1>
      <div className="card p-4 flex items-center gap-3">
        <Avatar name={me.name} image={me.image} size={48} />
        <div>
          <div className="font-medium">{me.name}</div>
          <div className="text-sm text-muted">{me.email}</div>
        </div>
      </div>

      <Link href="/settings/apple-pay" className="card p-4 flex items-center gap-3 hover:bg-card-2 transition-colors">
        <span className="text-2xl">📲</span>
        <span className="flex-1 min-w-0">
          <span className="block font-medium">Apple Pay auto-log</span>
          <span className="block text-xs text-muted">
            {applePayKey ? `On · key ending in …${applePayKey.hint}` : "Log every Apple Pay tap automatically with an iPhone Shortcut"}
          </span>
        </span>
        <span className="text-muted">›</span>
      </Link>

      <form action={updateNotificationPrefs} className="card p-4 space-y-4">
        <div className="font-medium">Email notifications</div>
        <label className="flex items-center gap-3">
          <input type="checkbox" name="reminderEmails" className="checkbox" defaultChecked={me.reminderEmails} />
          <span>
            <span className="block">Daily reminder</span>
            <span className="block text-xs text-muted">Sent in the evening if you haven&apos;t logged anything that day.</span>
          </span>
        </label>
        <label className="flex items-center gap-3">
          <input type="checkbox" name="recapEmails" className="checkbox" defaultChecked={me.recapEmails} />
          <span>
            <span className="block">Weekly &amp; monthly Wrapped</span>
            <span className="block text-xs text-muted">A link to your recap when it&apos;s ready.</span>
          </span>
        </label>
        <SubmitButton>Save</SubmitButton>
      </form>

      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
      >
        <button className="btn btn-secondary">Sign out</button>
      </form>
    </div>
  );
}
