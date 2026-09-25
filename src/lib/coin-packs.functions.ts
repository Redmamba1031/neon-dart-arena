import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type StripeEnv, createStripeClient } from "@/lib/stripe.server";
import { ALLOWED_STATES_LABEL, isAllowedRegion } from "@/lib/geo";

let _admin: ReturnType<typeof createClient> | null = null;
function admin() {
  if (!_admin) {
    _admin = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }
  return _admin;
}

async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string; userId: string },
): Promise<string> {
  if (!/^[a-zA-Z0-9_-]+$/.test(options.userId)) throw new Error("Invalid userId");

  const found = await stripe.customers.search({
    query: `metadata['userId']:'${options.userId}'`,
    limit: 1,
  });
  if (found.data.length) return found.data[0].id;

  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    if (existing.data.length) {
      const customer = existing.data[0];
      if (customer.metadata?.userId !== options.userId) {
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, userId: options.userId },
        });
      }
      return customer.id;
    }
  }

  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    metadata: { userId: options.userId },
  });
  return created.id;
}

export const createCoinPackCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { priceId: string; returnUrl: string; environment: StripeEnv }) => {
    if (!/^[a-zA-Z0-9_]+$/.test(data.priceId)) throw new Error("Invalid priceId");
    if (data.environment !== "sandbox" && data.environment !== "live") {
      throw new Error("Invalid environment");
    }
    if (typeof data.returnUrl !== "string" || !data.returnUrl.startsWith("http")) {
      throw new Error("Invalid return URL");
    }
    return data;
  })
  .handler(async ({ data, context }) => {
    const { userId, claims } = context as { userId: string; claims: { email?: string } };

    // Limited-state launch: block purchases from anywhere else
    const { data: profileRow } = await admin()
      .from("profiles")
      .select("region_code, country")
      .eq("id", userId)
      .maybeSingle();
    const profile = profileRow as { region_code?: string | null; country?: string | null } | null;
    if (!profile?.region_code) {
      throw new Error("Set your location in your profile before adding funds");
    }
    if (!isAllowedRegion(profile.country, profile.region_code)) {
      throw new Error(`SMYD is currently live in ${ALLOWED_STATES_LABEL} only — adding funds is not available in your area yet`);
    }


    // Look up coin pack in catalog (source of truth for coins granted)
    const { data: packRow, error: packErr } = await admin()
      .from("coin_packs")
      .select("price_id, name, usd_cents, coins_granted, active")
      .eq("price_id", data.priceId)
      .eq("active", true)
      .maybeSingle();
    if (packErr) throw new Error(packErr.message);
    if (!packRow) throw new Error("Coin pack not available");
    const pack = packRow as { price_id: string; name: string; coins_granted: number };


    const stripe = createStripeClient(data.environment);

    // Resolve Stripe price by lookup_key (stable across sandbox/live)
    const prices = await stripe.prices.list({ lookup_keys: [data.priceId] });
    if (!prices.data.length) throw new Error("Stripe price not found");
    const stripePrice = prices.data[0];

    const customerId = await resolveOrCreateCustomer(stripe, {
      userId,
      email: claims.email,
    });

    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: stripePrice.id, quantity: 1 }],
      mode: "payment",
      ui_mode: "embedded_page",
      return_url: data.returnUrl,
      customer: customerId,
      metadata: {
        userId,
        kind: "coin_pack",
        pack_id: pack.price_id,
        coins_granted: String(pack.coins_granted),
      },
      payment_intent_data: {
        description: pack.name,
        metadata: {
          userId,
          kind: "coin_pack",
          pack_id: pack.price_id,
          coins_granted: String(pack.coins_granted),
        },
      },

    });

    return session.client_secret;
  });

// Custom amount deposit ($5–$500): player picks the amount, credited 1:1.
export const CUSTOM_DEPOSIT_MIN_CENTS = 500;
export const CUSTOM_DEPOSIT_MAX_CENTS = 50_000;

export const createCustomDepositCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { amountCents: number; returnUrl: string; environment: StripeEnv }) => {
    const cents = Math.round(Number(data.amountCents));
    if (!Number.isFinite(cents) || cents < CUSTOM_DEPOSIT_MIN_CENTS || cents > CUSTOM_DEPOSIT_MAX_CENTS) {
      throw new Error("Amount must be between $5 and $500");
    }
    if (data.environment !== "sandbox" && data.environment !== "live") {
      throw new Error("Invalid environment");
    }
    if (typeof data.returnUrl !== "string" || !data.returnUrl.startsWith("http")) {
      throw new Error("Invalid return URL");
    }
    return { ...data, amountCents: cents };
  })
  .handler(async ({ data, context }) => {
    const { userId, claims } = context as { userId: string; claims: { email?: string } };

    const { data: profileRow } = await admin()
      .from("profiles")
      .select("region_code, country")
      .eq("id", userId)
      .maybeSingle();
    const profile = profileRow as { region_code?: string | null; country?: string | null } | null;
    if (!profile?.region_code) {
      throw new Error("Set your location in your profile before adding funds");
    }
    if (!isAllowedRegion(profile.country, profile.region_code)) {
      throw new Error(`SMYD is currently live in ${ALLOWED_STATES_LABEL} only — adding funds is not available in your area yet`);
    }

    const stripe = createStripeClient(data.environment);
    const customerId = await resolveOrCreateCustomer(stripe, {
      userId,
      email: claims.email,
    });

    const session = await stripe.checkout.sessions.create({
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: { name: "SMYD account funds" },
          unit_amount: data.amountCents,
        },
        quantity: 1,
      }],
      mode: "payment",
      ui_mode: "embedded_page",
      return_url: data.returnUrl,
      customer: customerId,
      metadata: {
        userId,
        kind: "coin_pack",
        pack_id: "custom",
        coins_granted: String(data.amountCents),
      },
      payment_intent_data: {
        description: "SMYD account funds",
        metadata: {
          userId,
          kind: "coin_pack",
          pack_id: "custom",
          coins_granted: String(data.amountCents),
        },
      },
    });

    return session.client_secret;
  });
