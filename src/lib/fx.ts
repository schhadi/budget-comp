/**
 * Convert between currencies using the free frankfurter.app API (ECB rates).
 * Falls back to 1:1 if the API is unavailable so an upload never fails on FX.
 */
export async function convertMinor(
  amountMinor: number,
  from: string,
  to: string,
  onDate?: string,
): Promise<{ minor: number; rate: number; converted: boolean }> {
  if (from === to) return { minor: amountMinor, rate: 1, converted: true };
  try {
    const datePart = onDate && onDate < new Date().toISOString().slice(0, 10) ? onDate : "latest";
    const res = await fetch(
      `https://api.frankfurter.app/${datePart}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      { next: { revalidate: 60 * 60 * 12 } },
    );
    if (!res.ok) throw new Error(`fx ${res.status}`);
    const data = (await res.json()) as { rates?: Record<string, number> };
    const rate = data.rates?.[to];
    if (!rate) throw new Error("rate missing");
    return { minor: Math.round(amountMinor * rate), rate, converted: true };
  } catch {
    return { minor: amountMinor, rate: 1, converted: false };
  }
}
