import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type StripeEnv, createStripeClient } from "@/lib/stripe.server";

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

export const createDepositCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { amountCents: number; returnUrl: string; environment: StripeEnv }) => {
    if (!Number.isInteger(data.amountCents) || data.amountCents < 500 || data.amountCents > 100_000_00) {
      throw new Error("Amount must be between $5 and $100,000");
    }
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
    const stripe = createStripeClient(data.environment);

    const customerId = await resolveOrCreateCustomer(stripe, {
      userId,
      email: claims.email,
    });

    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: "SMYD Wallet Deposit" },
            unit_amount: data.amountCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      ui_mode: "embedded_page",
      return_url: data.returnUrl,
      customer: customerId,
      metadata: {
        userId,
        kind: "wallet_deposit",
        amount_cents: String(data.amountCents),
      },
      payment_intent_data: {
        metadata: {
          userId,
          kind: "wallet_deposit",
          amount_cents: String(data.amountCents),
        },
      },
    });

    return session.client_secret;
  });
