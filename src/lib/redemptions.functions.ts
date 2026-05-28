import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createGiftCardOrder } from "@/lib/tremendous.server";

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

const RedeemSchema = z.object({
  optionId: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_]+$/),
  deliveryEmail: z.string().trim().email().max(254),
  recipientName: z.string().trim().min(1).max(80).optional(),
});

export const redeemGiftCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RedeemSchema.parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as { supabase: any; userId: string };
    const supabase = ctx.supabase;

    // 1. Debit coins + insert pending redemption row (atomic via RPC, RLS as user)
    const { data: rid, error: rpcErr } = await supabase.rpc("redeem_gift_card", {
      _option_id: data.optionId,
      _delivery_email: data.deliveryEmail,
      _recipient_name: data.recipientName ?? null,
    });
    if (rpcErr) throw new Error(rpcErr.message);
    const redemptionId = rid as string;

    // 2. Look up the row (we need denomination for the order)
    const { data: rowData, error: rowErr } = await admin()
      .from("gift_card_redemptions")
      .select("denomination_usd_cents, delivery_email, recipient_name")
      .eq("id", redemptionId)
      .single();
    if (rowErr || !rowData) {
      await (admin().rpc as any)("_refund_redemption", {
        _redemption_id: redemptionId,
        _reason: "Lookup failed",
      });
      throw new Error("Redemption lookup failed");
    }
    const row = rowData as {
      denomination_usd_cents: number;
      delivery_email: string;
      recipient_name: string | null;
    };

    // 3. Place Tremendous order
    try {
      const order = await createGiftCardOrder({
        redemptionId,
        amountUsdCents: Number(row.denomination_usd_cents),
        recipientEmail: row.delivery_email,
        recipientName: row.recipient_name ?? undefined,
      });
      await (admin().rpc as any)("_mark_redemption_fulfilled", {
        _redemption_id: redemptionId,
        _order_id: order.orderId,
        _reward_id: order.rewardId,
      });
      return { redemptionId, status: "fulfilled" as const };
    } catch (e) {
      const reason = e instanceof Error ? e.message.slice(0, 500) : "Tremendous error";
      await (admin().rpc as any)("_refund_redemption", {
        _redemption_id: redemptionId,
        _reason: reason,
      });
      throw new Error(`Gift card provider error: ${reason}. Your coins were refunded.`);
    }
  });

