import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type StripeEnv, createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";
import { CHAMP_CAPS, CHAMP_CUTOFF_MS, CHAMP_MIN_PLAYERS, capEligibility, capLabel, isValidSlot } from "@/lib/champ";

const ALLOWED_COUNTRIES = ["US", "GB", "IE", "SE"];

export const createChampCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cap: string; startsAt: number; returnUrl: string; environment: StripeEnv }) => {
    if (d.environment !== "sandbox" && d.environment !== "live") throw new Error("Invalid environment");
    if (!(CHAMP_CAPS as readonly string[]).includes(d.cap)) throw new Error("Invalid division");
    if (!Number.isFinite(d.startsAt)) throw new Error("Invalid time");
    if (!d.returnUrl.startsWith("http")) throw new Error("Invalid return URL");
    return d;
  })
  .handler(async ({ data, context }): Promise<{ clientSecret: string } | { error: string }> => {
    const { userId, claims } = context as any;
    if (!isValidSlot(data.startsAt)) return { error: "Registration for this bracket is closed (closes 30 minutes before start)." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: p } = await (supabaseAdmin as any).from("profiles")
      .select("age_verified, country, region_code, cricket_mpr, mpr_verified").eq("id", userId).maybeSingle();
    if (!p?.age_verified) return { error: "Verify your age & ID before entering paid tournaments." };
    if (!p.region_code || !ALLOWED_COUNTRIES.includes((p.country ?? "").toUpperCase())) {
      return { error: "Set your location in your profile. SMYD Champ is open in the US, UK, Ireland and Sweden." };
    }
    const { data: ban } = await (supabaseAdmin as any).from("player_bans").select("user_id").eq("user_id", userId).maybeSingle();
    if (ban) return { error: "Your account can't enter tournaments." };
    const why = capEligibility(data.cap, p.cricket_mpr == null ? null : Number(p.cricket_mpr), !!p.mpr_verified);
    if (why) return { error: why };
    const startsIso = new Date(data.startsAt).toISOString();
    const { data: dup } = await (supabaseAdmin as any).from("champ_entries").select("id")
      .eq("user_id", userId).eq("cap", data.cap).eq("starts_at", startsIso).eq("status", "paid").maybeSingle();
    if (dup) return { error: "You're already registered for this bracket." };
    try {
      const stripe = createStripeClient(data.environment);
      const prices = await stripe.prices.list({ lookup_keys: ["smyd_champ_entry_25"] });
      if (!prices.data.length) return { error: "Entry price not found" };
      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: prices.data[0].id, quantity: 1 }],
        mode: "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        ...(claims?.email && { customer_email: claims.email }),
        payment_intent_data: { description: `SMYD Champ Cricket · ${capLabel(data.cap)} · ${startsIso}` },
        metadata: { kind: "champ", userId, cap: data.cap, starts_at: startsIso },
      });
      return { clientSecret: session.client_secret ?? "" };
    } catch (e) {
      return { error: getStripeErrorMessage(e) };
    }
  });

/** Refund every paid entry in brackets that hit the cutoff below the 3-player minimum. Idempotent. */
export const closeUnderfilledBrackets = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const cutoffIso = new Date(Date.now() + CHAMP_CUTOFF_MS).toISOString();
  const { data: rows } = await db.from("champ_entries").select("id, cap, starts_at, payment_intent, environment")
    .eq("status", "paid").lte("starts_at", cutoffIso).gte("starts_at", new Date(Date.now() - 7 * 864e5).toISOString());
  const groups = new Map<string, any[]>();
  for (const r of rows ?? []) {
    const k = `${r.cap}|${r.starts_at}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  let refunded = 0;
  for (const list of groups.values()) {
    if (list.length >= CHAMP_MIN_PLAYERS) continue;
    for (const e of list) {
      const { data: claimed } = await db.from("champ_entries").update({ status: "refunding" })
        .eq("id", e.id).eq("status", "paid").select("id").maybeSingle();
      if (!claimed) continue;
      try {
        if (e.payment_intent) {
          await createStripeClient(e.environment).refunds.create(
            { payment_intent: e.payment_intent },
            { idempotencyKey: `champ-refund-${e.id}` },
          );
        }
        await db.from("champ_entries").update({ status: "refunded", refunded_at: new Date().toISOString() }).eq("id", e.id);
        refunded++;
      } catch (err) {
        console.error("champ refund failed", e.id, err);
        await db.from("champ_entries").update({ status: "refund_failed" }).eq("id", e.id);
      }
    }
  }
  return { refunded };
});
