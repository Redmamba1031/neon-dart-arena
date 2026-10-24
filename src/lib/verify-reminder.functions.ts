import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type VerifyReminderResult =
  | { sent: true }
  | { sent: false; reason: "already_verified" | "already_sent" | "no_email" | "suppressed" };

/**
 * Sends the verification reminder to the signed-in player — once ever.
 * Triggered by the player's own activity (opening the lobby while
 * unverified), never by a bulk/scheduled job.
 */
export const sendMyVerificationReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<VerifyReminderResult> => {
    const { supabase, userId } = context as {
      supabase: any;
      userId: string;
    };

    const { data: profile } = await supabase
      .from("profiles")
      .select("age_verified, display_name, username")
      .eq("id", userId)
      .maybeSingle();
    if (profile?.age_verified) return { sent: false, reason: "already_verified" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Dedupe: one reminder per account, ever.
    const { data: existing } = await supabaseAdmin
      .from("admin_actions")
      .select("id")
      .eq("action", "verify_reminder")
      .eq("target_user_id", userId)
      .limit(1);
    if (existing && existing.length > 0) return { sent: false, reason: "already_sent" };

    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
    const email = userData?.user?.email;
    if (!email) return { sent: false, reason: "no_email" };

    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    const result = await sendTemplateEmail("verify-reminder", email, {
      templateData: {
        name: profile?.display_name || profile?.username || undefined,
        verifyUrl: "https://smyd.online/verify-identity",
      },
      idempotencyKey: `verify-reminder-${userId}`,
    });

    // Log even when suppressed so we don't retry a suppressed address.
    await supabaseAdmin.from("admin_actions").insert({
      action: "verify_reminder",
      admin_id: userId,
      target_user_id: userId,
      note: result.sent
        ? "Automatic verification reminder sent (player opened lobby unverified)."
        : "Verification reminder skipped — recipient suppressed.",
    });

    return result.sent ? { sent: true } : { sent: false, reason: "suppressed" };
  });
