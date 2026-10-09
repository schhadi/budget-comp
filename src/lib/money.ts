export const CURRENCIES = ["GBP", "EUR", "USD", "CAD", "AUD", "INR", "PKR", "NGN", "AED", "SAR", "TRY", "JPY", "CNY", "KRW", "MYR", "SGD", "HKD", "CHF", "SEK", "NOK", "DKK", "PLN", "ZAR", "BRL", "MXN"] as const;

const ZERO_DECIMAL = new Set(["JPY", "KRW"]);

export function minorUnits(currency: string) {
  return ZERO_DECIMAL.has(currency) ? 1 : 100;
}

export function toMinor(amount: number, currency: string) {
  return Math.round(amount * minorUnits(currency));
}

export function fromMinor(minor: number, currency: string) {
  return minor / minorUnits(currency);
}

export function formatMoney(minor: number, currency: string, opts: { compact?: boolean } = {}) {
  const value = fromMinor(minor, currency);
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      maximumFractionDigits: opts.compact && Math.abs(value) >= 100 ? 0 : undefined,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

export function parseAmountInput(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.,-]/g, "").replace(",", ".");
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}
