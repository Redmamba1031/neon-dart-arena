import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

// Creates a PayPal order for an active amount and returns the approval link.
export const createPaypalDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { priceId: string; origin: string }) => {
    if (!/^[a-zA-Z0-9_]+$/.test(data.priceId)) throw new Error("Invalid amount");
    if (!/^https?:\/\/[^\s/]+$/.test(data.origin)) throw new Error("Invalid origin");
    return data;
  })
  .handler(async ({ data, context }) => {
    try {
      const { paypalBase, paypalToken } = await import("@/lib/payouts.server");
      const admin = await getAdmin();
      const userId = context.userId;

      const { data: profile } = await admin
        .from("profiles").select("region_code, country").eq("id", userId).maybeSingle();
      const p = profile as { region_code?: string | null; country?: string | null } | null;
      if (!p?.region_code) return { error: "Set your location in your profile before adding funds" };
      if (!isAllowedRegion(p.country, p.region_code)) {
        return { error: `SMYD is currently live in ${ALLOWED_STATES_LABEL} only — adding funds is not available in your area yet` };
      }

      const { data: pack } = await admin
        .from("coin_packs").select("price_id, name, usd_cents, active")
        .eq("price_id", data.priceId).eq("active", true).maybeSingle();
      const pk = pack as { price_id: string; name: string; usd_cents: number } | null;
      if (!pk) return { error: "That amount isn't available" };

      const token = await paypalToken();
      const res = await fetch(`${paypalBase()}/v2/checkout/orders`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [{
            reference_id: pk.price_id,
            custom_id: userId,
            description: `SMYD funds: ${pk.name}`,
            amount: { currency_code: "USD", value: (pk.usd_cents / 100).toFixed(2) },
          }],
          payment_source: {
            paypal: {
              experience_context: {
                brand_name: "SMYD",
                user_action: "PAY_NOW",
                shipping_preference: "NO_SHIPPING",
                return_url: `${data.origin}/checkout/paypal`,
                cancel_url: `${data.origin}/shop`,
              },
            },
          },
        }),
      });
      const json = (await res.json()) as { id?: string; links?: { rel: string; href: string }[]; message?: string };
      const link = json.links?.find((l) => l.rel === "payer-action" || l.rel === "approve")?.href;
      if (!res.ok || !link) return { error: json.message ?? "PayPal could not start checkout" };
      return { url: link };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "PayPal checkout failed" };
    }
  });

// Captures an approved order and credits the player's balance (idempotent).
export const capturePaypalDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orderId: string }) => {
    if (!/^[A-Z0-9]{8,40}$/.test(data.orderId)) throw new Error("Invalid order");
    return data;
  })
  .handler(async ({ data, context }) => {
    try {
      const { paypalBase, paypalToken } = await import("@/lib/payouts.server");
      const token = await paypalToken();
      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

      let order = (await (await fetch(`${paypalBase()}/v2/checkout/orders/${data.orderId}`, { headers })).json()) as any;
      if (order?.purchase_units?.[0]?.custom_id !== context.userId) return { error: "This payment belongs to another account" };

      if (order.status === "APPROVED") {
        const r = await fetch(`${paypalBase()}/v2/checkout/orders/${data.orderId}/capture`, {
          method: "POST", headers: { ...headers, "PayPal-Request-Id": `cap-${data.orderId}` },
        });
        order = await r.json();
        if (!r.ok) return { error: order?.message ?? "PayPal could not complete the payment" };
      }
      if (order.status !== "COMPLETED") return { error: `Payment not completed (${order.status ?? "unknown"})` };

      const unit = order.purchase_units[0];
      const capture = unit.payments?.captures?.[0];
      if (!capture || capture.status !== "COMPLETED") return { error: "Payment is still pending at PayPal" };

      const admin = await getAdmin();
      const { data: pack } = await admin
        .from("coin_packs").select("usd_cents, coins_granted").eq("price_id", unit.reference_id).maybeSingle();
      const pk = pack as { usd_cents: number; coins_granted: number } | null;
      const paidCents = Math.round(Number(capture.amount?.value) * 100);
      if (!pk || capture.amount?.currency_code !== "USD" || paidCents !== Number(pk.usd_cents)) {
        return { error: "Payment amount didn't match — contact support" };
      }

      const { error } = await (admin.rpc as any)("credit_wallet_from_deposit", {
        _user_id: context.userId,
        _session_id: `paypal_${data.orderId}`,
        _payment_intent: `paypal_capture_${capture.id}`,
        _coins_granted: Number(pk.coins_granted),
        _environment: (process.env["PAYPAL_ENV"] ?? "live") === "sandbox" ? "sandbox" : "live",
      });
      if (error) return { error: error.message };
      return { ok: true as const, amountCents: Number(pk.coins_granted) };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "PayPal capture failed" };
    }
  });
