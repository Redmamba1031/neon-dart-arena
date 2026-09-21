import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const startPayoutAccountSetup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { returnUrl: string }) => {
    if (typeof data?.returnUrl !== "string" || !data.returnUrl.startsWith("http")) {
      throw new Error("Invalid return URL");
    }
    return data;
  })
  .handler(async ({ data, context }) => {
    const { userId, claims } = context as { userId: string; claims: { email?: string } };
    const { ensureConnectAccount } = await import("@/lib/payouts.server");
    try {
      const url = await ensureConnectAccount(userId, claims?.email, data.returnUrl);
      return { url, error: null as string | null };
    } catch (e) {
      return { url: null, error: (e as { message?: string })?.message ?? "Could not start setup" };
    }
  });

export const refreshPayoutAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context as { userId: string };
    const { syncConnectAccount } = await import("@/lib/payouts.server");
    try {
      return { ...(await syncConnectAccount(userId)), error: null as string | null };
    } catch (e) {
      return {
        connected: false,
        payoutsEnabled: false,
        error: (e as { message?: string })?.message ?? "Could not refresh payout account",
      };
    }
  });

export const releaseDuePayouts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context as { userId: string };
    const { adminDb, runDuePayouts } = await import("@/lib/payouts.server");

    const { data: staff, error: staffErr } = await adminDb().rpc("is_staff", { _user_id: userId });
    if (staffErr) return { error: staffErr.message, processed: 0, paid: 0, failed: 0, errors: [] };
    if (!staff) return { error: "Staff only", processed: 0, paid: 0, failed: 0, errors: [] };

    try {
      return { ...(await runDuePayouts(25)), error: null as string | null };
    } catch (e) {
      return {
        processed: 0,
        paid: 0,
        failed: 0,
        errors: [],
        error: (e as { message?: string })?.message ?? "Payout run failed",
      };
    }
  });
