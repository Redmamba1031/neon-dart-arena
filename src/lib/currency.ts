// Balances are always stored and paid in US dollars. Players in other
// countries also see an approximate local-currency equivalent.

export const COUNTRY_CURRENCY: Record<string, string> = { GB: "GBP", IE: "EUR", SE: "SEK" };

// Fallback rates (1 USD = x). Refreshed from a live feed when available.
const rates: Record<string, number> = { GBP: 0.75, EUR: 0.86, SEK: 9.4 };
let localCurrency: string | null = null;
let fetched = false;

export function setLocalCurrencyForCountry(country: string | null | undefined): boolean {
  const next = (country && COUNTRY_CURRENCY[country]) || null;
  const changed = next !== localCurrency;
  localCurrency = next;
  return changed;
}

export async function refreshRates(): Promise<boolean> {
  if (fetched) return false;
  fetched = true;
  try {
    const r = await fetch("https://open.er-api.com/v6/latest/USD");
    const j = await r.json();
    let changed = false;
    for (const c of Object.keys(rates)) {
      const v = j?.rates?.[c];
      if (typeof v === "number" && v > 0) { rates[c] = v; changed = true; }
    }
    return changed;
  } catch {
    return false;
  }
}

/** Approximate local equivalent like "≈ £15.00", or "" for US players. */
export function localEquivalent(cents: number): string {
  if (!localCurrency) return "";
  const v = (cents / 100) * (rates[localCurrency] ?? 1);
  return `≈ ${v.toLocaleString(undefined, { style: "currency", currency: localCurrency })}`;
}
