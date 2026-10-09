export function appUrl() {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export const PARSER_MODEL = process.env.PARSER_MODEL || "claude-opus-5-5";
export const RECAP_MODEL = process.env.RECAP_MODEL || PARSER_MODEL;

export type ShortcutInputMode = "text" | "transaction";

export interface ApplePayShortcut {
  /** iCloud link to the shared shortcut, e.g. https://www.icloud.com/shortcuts/… */
  url: string;
  /** Exact name of the shortcut once added; used in the `shortcuts://run-shortcut` connect link. */
  name: string;
  /**
   * "text": each person's automation renders merchant, amount and card into a Text action and
   * runs the shared shortcut with it (works everywhere). "transaction": the shared shortcut reads
   * the Wallet transaction itself, so the automation just picks it. See docs/apple-pay-shortcut.md.
   */
  input: ShortcutInputMode;
}

/** One-tap Apple Pay setup is on once the owner has shared the shortcut and set APPLE_PAY_SHORTCUT_URL. */
export function applePayShortcut(): ApplePayShortcut | null {
  const url = process.env.APPLE_PAY_SHORTCUT_URL?.trim();
  if (!url) return null;
  return {
    url,
    name: process.env.APPLE_PAY_SHORTCUT_NAME?.trim() || "Who Can Spend the Less?",
    input: process.env.APPLE_PAY_SHORTCUT_INPUT?.trim().toLowerCase() === "transaction" ? "transaction" : "text",
  };
}
