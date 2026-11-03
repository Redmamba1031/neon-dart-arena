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

export type ChampFormat = "singles" | "doubles";

/** Doubles: both MPRs verified and their sum at or below the cap. */
export function teamCapEligibility(cap: string, a: { mpr: number | null; verified: boolean }, b: { mpr: number | null; verified: boolean }): string | null {
  if (cap === "open") return null;
  if (!a.verified || a.mpr == null || !b.verified || b.mpr == null) return "Both teammates need a verified Cricket MPR for capped doubles";
  const sum = a.mpr + b.mpr;
  if (sum > Number(cap) + 1e-9) return `Team MPR ${sum.toFixed(2)} is above the ${cap} cap`;
  return null;
}

/** Complete doubles teams: pairs where both players paid and named each other. */
export function completeTeams<T extends { user_id: string; partner_id: string | null }>(list: T[]): [T, T][] {
  const byId = new Map(list.map((e) => [e.user_id, e]));
  const seen = new Set<string>();
  const out: [T, T][] = [];
  for (const e of list) {
    if (seen.has(e.user_id) || !e.partner_id) continue;
    const p = byId.get(e.partner_id);
    if (p && p.partner_id === e.user_id) { out.push([e, p]); seen.add(e.user_id); seen.add(p.user_id); }
  }
  return out;
}

/** Payout split for doubles: same scale by team count, $38 per team to the pool. */
export function doublesPayoutSplit(teams: number): number[] {
  return payoutSplit(teams).map((c) => c * 2);
}
