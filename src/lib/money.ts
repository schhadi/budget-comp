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

// ---------------- Parsing amounts sent by the Apple Pay shortcut ----------------

/** Symbol → ISO code. Longer, more specific symbols first so "CA$" wins over "$". */
const CURRENCY_SYMBOLS: [string, string][] = [
  ["US$", "USD"],
  ["CA$", "CAD"],
  ["C$", "CAD"],
  ["A$", "AUD"],
  ["HK$", "HKD"],
  ["S$", "SGD"],
  ["R$", "BRL"],
  ["MX$", "MXN"],
  ["£", "GBP"],
  ["€", "EUR"],
  ["$", "USD"],
  ["¥", "JPY"],
  ["₹", "INR"],
  ["₨", "PKR"],
  ["₦", "NGN"],
  ["₺", "TRY"],
  ["₩", "KRW"],
  ["zł", "PLN"],
];

export function normaliseCurrencyCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : null;
}

/**
 * Parse an amount the way it might arrive from an iPhone Shortcut: a number, "£4.50",
 * "4,50 €", "GBP 12.00", "-£3.20", "1,234.56", or an object like { amount, currency }.
 * Returns the absolute amount (Apple reports outgoing payments as negatives sometimes)
 * and the currency if one could be read from the text.
 */
export function parseMoneyText(raw: unknown): { amount: number | null; currency: string | null } {
  if (typeof raw === "number") return { amount: Number.isFinite(raw) ? Math.abs(raw) : null, currency: null };
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const inner = parseMoneyText(o.amount ?? o.value ?? o.total);
    return { amount: inner.amount, currency: normaliseCurrencyCode(o.currency ?? o.currencyCode) ?? inner.currency };
  }
  if (typeof raw !== "string") return { amount: null, currency: null };
  const text = raw.trim();
  if (!text) return { amount: null, currency: null };

  let currency: string | null = null;
  const code = text.toUpperCase().match(/(?:^|[^A-Z])([A-Z]{3})(?![A-Z])/);
  if (code && (CURRENCIES as readonly string[]).includes(code[1])) currency = code[1];
  if (!currency) {
    const hit = CURRENCY_SYMBOLS.find(([symbol]) => text.includes(symbol));
    if (hit) currency = hit[1];
  }

  const numberMatch = text.match(/\d(?:[\d.,  ]*\d)?/);
  if (!numberMatch) return { amount: null, currency };
  return { amount: parseLocalisedNumber(numberMatch[0]), currency };
}

function parseLocalisedNumber(s: string): number | null {
  const compact = s.replace(/[  ]/g, "");
  const lastComma = compact.lastIndexOf(",");
  const lastDot = compact.lastIndexOf(".");
  let normalised: string;
  if (lastComma >= 0 && lastDot >= 0) {
    // Both present: whichever comes last is the decimal separator ("1,234.56" or "1.234,56").
    normalised = lastComma > lastDot ? compact.replace(/\./g, "").replace(",", ".") : compact.replace(/,/g, "");
  } else if (lastComma >= 0) {
    const commas = compact.split(",").length - 1;
    const digitsAfter = compact.length - lastComma - 1;
    // "4,50" is a decimal comma; "1,234" and "1,234,567" are thousands separators.
    normalised = commas === 1 && digitsAfter !== 3 ? compact.replace(",", ".") : compact.replace(/,/g, "");
  } else {
    const dots = compact.split(".").length - 1;
    normalised = dots > 1 ? compact.replace(/\./g, "") : compact;
  }
  const n = Number(normalised);
  return Number.isFinite(n) ? Math.abs(n) : null;
}
