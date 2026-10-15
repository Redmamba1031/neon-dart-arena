import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type StripeEnv, createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";

const DESIGNS: Record<string, string> = { neon: "Neon Voltage", crimson: "Crimson Flame", tour: "Tour White" };
const SIZES = ["S", "M", "L", "XL", "2XL"];

export const createJerseyCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { design: string; size: string; name: string; number: string; quantity: number; returnUrl: string; environment: StripeEnv }) => {
    if (d.environment !== "sandbox" && d.environment !== "live") throw new Error("Invalid environment");
    if (!DESIGNS[d.design] || !SIZES.includes(d.size)) throw new Error("Invalid design or size");
    if (!/^[A-Za-z .'-]{2,14}$/.test(d.name.trim())) throw new Error("Invalid name");
    if (d.number !== "" && !/^[0-9]{1,2}$/.test(d.number)) throw new Error("Invalid number");
    if (!Number.isInteger(d.quantity) || d.quantity < 1 || d.quantity > 10) throw new Error("Invalid quantity");
    if (!d.returnUrl.startsWith("http")) throw new Error("Invalid return URL");
    return d;
  })
  .handler(async ({ data, context }): Promise<{ clientSecret: string } | { error: string }> => {
    const { userId, claims } = context as any;
    try {
      const stripe = createStripeClient(data.environment);
      const prices = await stripe.prices.list({ lookup_keys: ["smyd_jersey_45"] });
      if (!prices.data.length) return { error: "Jersey price not found" };
      const name = data.name.trim().toUpperCase();
      const desc = `SMYD ${DESIGNS[data.design]} jersey ${data.size} · ${name}${data.number ? ` #${data.number}` : ""}`;
      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: prices.data[0].id, quantity: data.quantity }],
        mode: "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        ...(claims?.email && { customer_email: claims.email }),
        shipping_address_collection: { allowed_countries: ["US", "GB", "IE", "SE"] },
        payment_intent_data: { description: desc },
        metadata: {
          kind: "jersey", userId, design: DESIGNS[data.design], size: data.size,
          jersey_name: name, number: data.number, quantity: String(data.quantity),
        },
      });
      return { clientSecret: session.client_secret ?? "" };
    } catch (e) {
      return { error: getStripeErrorMessage(e) };
    }
  });
