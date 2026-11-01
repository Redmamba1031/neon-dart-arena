// Shared SMYD Champ rules (browser + server safe).
export const CHAMP_CAPS = [
  "1.5", "2.0", "2.5", "3.0", "3.5", "4.0", "4.5", "5.0",
  "5.5", "6.0", "6.5", "7.0", "7.5", "8.0", "8.5", "open",
] as const;
export type ChampCap = (typeof CHAMP_CAPS)[number];

export const CHAMP_ENTRY_CENTS = 2500;
export const CHAMP_FEE_CENTS = 600;
export const CHAMP_POOL_CENTS = 1900;
export const CHAMP_MIN_PLAYERS = 3;
export const CHAMP_CUTOFF_MS = 30 * 60 * 1000;
export const SLOT_MS = 30 * 60 * 1000;

export function capLabel(cap: string) {
  return cap === "open" ? "No Cap" : `${cap} Cap`;
}

/** Bracket start times (every :00 and :30) whose registration is still open. */
export function upcomingSlots(now = Date.now(), count = 8): number[] {
  const first = Math.ceil((now + CHAMP_CUTOFF_MS + 1) / SLOT_MS) * SLOT_MS;
  return Array.from({ length: count }, (_, i) => first + i * SLOT_MS);
}

export function isValidSlot(startsAt: number, now = Date.now()) {
  return startsAt % SLOT_MS === 0 && startsAt - CHAMP_CUTOFF_MS > now && startsAt - now < 7 * 24 * 3600 * 1000;
}

/** Who may enter a division. */
export function capEligibility(cap: string, mpr: number | null, verified: boolean): string | null {
  if (cap === "open") return null;
  if (!verified || mpr == null) return "Verify your Cricket MPR to enter capped divisions";
  if (mpr > Number(cap)) return `Your MPR ${mpr.toFixed(2)} is above the ${cap} cap`;
  return null;
}

/** DartsTOC-style payout split of the $19/entry pool, in cents. */
export function payoutSplit(players: number): number[] {
  if (players < CHAMP_MIN_PLAYERS) return [];
  const pool = players * CHAMP_POOL_CENTS;
  const pct = players <= 5 ? [65, 35] : players <= 12 ? [50, 30, 20] : [45, 25, 18, 12];
  const out = pct.map((p) => Math.floor((pool * p) / 100));
  out[0] += pool - out.reduce((a, b) => a + b, 0);
  return out;
}
