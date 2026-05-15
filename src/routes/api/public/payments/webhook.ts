import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }
  return _supabase;
}

async function handleCheckoutCompleted(session: any, env: StripeEnv) {
  if (session.metadata?.kind !== "wallet_deposit") {
    console.log("Skipping non-wallet session", session.id);
    return;
  }
  if (session.payment_status !== "paid") {
    console.log("Session not paid yet", session.id, session.payment_status);
    return;
  }

  const userId = session.metadata.userId;
  const amountCents = Number(session.metadata.amount_cents) || session.amount_total;
  if (!userId || !amountCents) {
    console.error("Missing userId or amount on session", session.id);
    return;
  }

  const { error } = await getSupabase().rpc("credit_wallet_from_deposit", {
    _user_id: userId,
    _session_id: session.id,
    _payment_intent: session.payment_intent ?? null,
    _amount_cents: amountCents,
    _environment: env,
  });
  if (error) {
    console.error("credit_wallet_from_deposit failed", error);
    throw error;
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          console.error("Webhook missing/invalid env query:", rawEnv);
          return Response.json({ received: true, ignored: "invalid env" });
        }
        const env: StripeEnv = rawEnv;
        try {
          const event = await verifyWebhook(request, env);
          switch (event.type) {
            case "checkout.session.completed":
            case "checkout.session.async_payment_succeeded":
              await handleCheckoutCompleted(event.data.object, env);
              break;
            default:
              console.log("Unhandled event:", event.type);
          }
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
