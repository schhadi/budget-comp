"use client";

import { updateNotificationPrefs } from "@/actions/leagues";
import { SwitchRow } from "./SwitchRow";

/** Email preference switches that save as soon as they're flipped. */
export function NotificationPrefs({ reminderEmails, recapEmails }: { reminderEmails: boolean; recapEmails: boolean }) {
  return (
    <form action={updateNotificationPrefs} onChange={(e) => e.currentTarget.requestSubmit()}>
      <SwitchRow name="reminderEmails" title="Daily reminder" subtitle="Evenings, only if you haven't logged anything." defaultChecked={reminderEmails} />
      <SwitchRow name="recapEmails" title="Weekly & monthly Wrapped" subtitle="A link to your recap when it's ready." defaultChecked={recapEmails} last />
    </form>
  );
}
