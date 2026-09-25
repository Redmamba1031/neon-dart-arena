import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type StripeEnv, createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";
import { ALLOWED_STATES_LABEL, isAllowedRegion } from "@/lib/geo";

export const MEMBERSHIP_PRICE_ID = "smyd_pro_monthly";

async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string; userId: string },
): Promise<string> {
  if (!/^[a-zA-Z0-9_-]+$/.test(options.userId)) throw new Error("Invalid userId");
  const found = await stripe.customers.search({ query: `metadata['userId']:'${options.userId}'`, limit: 1 });
  if (found.data.length) return found.data[0].id;
  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    if (existing.data.length) {
      const c = existing.data[0];
      if (c.metadata?.userId !== options.userId) {
        await stripe.customers.update(c.id, { metadata: { ...c.metadata, userId: options.userId } });
      }
      return c.id;
    }
  }
  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    metadata: { userId: options.userId },
  });
  return created.id;
}

export const createMembershipCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { returnUrl: string; environment: StripeEnv }) => {
    if (data.environment !== "sandbox" && data.environment !== "live") throw new Error("Invalid environment");
    if (typeof data.returnUrl !== "string" || !data.returnUrl.startsWith("http")) throw new Error("Invalid return URL");
    return data;
  })
  .handler(async ({ data, context }): Promise<{ clientSecret: string } | { error: string }> => {
    const { supabase, userId, claims } = context as any;
    const { data: profile } = await supabase
      .from("profiles").select("region_code, country").eq("id", userId).maybeSingle();
    if (!profile?.region_code) return { error: "Set your location in your profile first" };
    if (!isAllowedRegion(profile.country, profile.region_code)) {
      return { error: `SMYD is currently live in ${ALLOWED_STATES_LABEL} only` };
    }
    const { data: existing } = await supabase
      .from("memberships").select("status, current_period_end").eq("user_id", userId).maybeSingle();
    if (existing && ["active", "trialing", "past_due"].includes(existing.status)) {
      return { error: "You're already a Pro member" };
    }
    try {
      const stripe = createStripeClient(data.environment);
      const prices = await stripe.prices.list({ lookup_keys: [MEMBERSHIP_PRICE_ID] });
      if (!prices.data.length) return { error: "Membership price not found" };
      const customerId = await resolveOrCreateCustomer(stripe, { userId, email: claims?.email });
      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: prices.data[0].id, quantity: 1 }],
        mode: "subscription",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer: customerId,
        metadata: { userId, kind: "membership" },
        subscription_data: { metadata: { userId, kind: "membership" } },
      });
      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });
