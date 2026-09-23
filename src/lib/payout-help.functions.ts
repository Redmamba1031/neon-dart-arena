import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Input = z.object({
  question: z.string().min(5).max(1000),
});

export type PayoutHelpAnswer = {
  cause: string;
  steps: string[];
  needsStaff: boolean;
  error: string | null;
};

export const explainPayoutIssue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data, context }): Promise<PayoutHelpAnswer> => {
    const { userId } = context as { userId: string };
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) {
      return { cause: "", steps: [], needsStaff: true, error: "Help assistant is not configured yet." };
    }

    const { adminDb } = await import("@/lib/payouts.server");
    const { data: rows } = await adminDb()
      .from("withdrawal_requests")
      .select("amount_cents, method, status, failure_reason, requires_review, risk_flags, hold_until, attempts, created_at, processed_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5);

    const history = (rows ?? []) as Record<string, unknown>[];

    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText, Output, NoObjectGeneratedError } = await import("ai");
    const { createLovableAiGatewayRunIdFetch } = await import("@/lib/ai-gateway.server");

    const runIdFetch = createLovableAiGatewayRunIdFetch();
    const lovable = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey: key,
      headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      fetch: runIdFetch.fetch,
    });

    const system = [
      "You are the SMYD darts app payout support assistant.",
      "Rules of the platform:",
      "- Cash outs are held 72 hours for fraud review before sending.",
      "- PayPal and Venmo cash outs send automatically; Bank/Card sends through Stripe and requires the player to finish connecting a payout account.",
      "- Cash App is no longer supported.",
      "- Minimum cash out is $5.00.",
      "- A payout marked 'requires review' waits for staff approval.",
      "- A failed payout returns the money to the player's SMYD balance after 3 attempts.",
      "- Players must be age verified and located in Indiana for paid play.",
      "Explain the single most likely cause in plain, friendly language (2-3 sentences, no jargon, no internal table or field names).",
      "Give 2-4 short next steps the player can take. Set needsStaff true only when staff must act.",
      "Support email: redmond1031@gmail.com.",
    ].join("\n");

    try {
      const result = streamText({
        model: lovable.responses("openai/gpt-6-astra"),
        system,
        prompt: [
          `Player's description of the problem: ${data.question}`,
          `Their last cash out requests (newest first): ${JSON.stringify(history)}`,
        ].join("\n\n"),
        output: Output.object({
          schema: z.object({
            cause: z.string(),
            steps: z.array(z.string()),
            needsStaff: z.boolean(),
          }),
        }),
        providerOptions: {
          openai: {
            forceReasoning: true,
            reasoningEffort: "low",
            reasoningSummary: "auto",
            store: false,
            include: ["reasoning.encrypted_content"],
          },
        },
      });

      const out = await result.output;
      return {
        cause: out.cause,
        steps: out.steps.slice(0, 4),
        needsStaff: out.needsStaff,
        error: null,
      };
    } catch (e) {
      if (NoObjectGeneratedError.isInstance(e)) {
        return {
          cause: "",
          steps: [],
          needsStaff: true,
          error: "Could not work out an answer right now. Email redmond1031@gmail.com and we'll look into it.",
        };
      }
      return {
        cause: "",
        steps: [],
        needsStaff: true,
        error: (e as { message?: string })?.message ?? "Help assistant is unavailable right now.",
      };
    }
  });
