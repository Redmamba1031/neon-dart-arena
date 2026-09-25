import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type IdCheckResult = {
  verified: boolean;
  reason: string;
};

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z ]/g, " ").split(/\s+/).filter(Boolean);
}

function ageOn(dob: string) {
  const d = new Date(dob + "T00:00:00Z");
  const now = new Date();
  let a = now.getUTCFullYear() - d.getUTCFullYear();
  const m = now.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < d.getUTCDate())) a--;
  return a;
}

/** Reads the player's uploaded photo ID and auto-verifies 18+ when name + DOB match the profile. */
export const checkMyIdDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<IdCheckResult> => {
    const { userId } = context as { userId: string };
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { verified: false, reason: "Automatic check unavailable — staff will review your ID." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: p } = await supabaseAdmin
      .from("profiles")
      .select("legal_name, date_of_birth, id_document_path, age_verified")
      .eq("id", userId)
      .maybeSingle();
    if (!p?.id_document_path) return { verified: false, reason: "Upload a photo ID first." };
    if (!p.legal_name || !p.date_of_birth) return { verified: false, reason: "Add your real name and date of birth first." };
    if (p.age_verified) return { verified: true, reason: "Already verified." };

    const { data: signed } = await supabaseAdmin.storage.from("id-documents").createSignedUrl(p.id_document_path, 300);
    if (!signed?.signedUrl) return { verified: false, reason: "Could not read your photo — staff will review it." };

    const { createOpenAI } = await import("@ai-sdk/openai");
    const { generateText, Output } = await import("ai");
    const lovable = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey: key,
      headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });

    let out: { isGovernmentId: boolean; fullName: string; dateOfBirth: string; expired: boolean; legible: boolean };
    try {
      const r = await generateText({
        model: lovable.chat("google/gemini-2.5-flash"),
        output: Output.object({
          schema: z.object({
            isGovernmentId: z.boolean(),
            legible: z.boolean(),
            expired: z.boolean(),
            fullName: z.string(),
            dateOfBirth: z.string().describe("YYYY-MM-DD, empty if unreadable"),
          }),
        }),
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Read this photo. Is it a government photo ID (driver's license, state ID, passport)? Extract the holder's full name and date of birth. Say if it's expired or illegible. Do not guess." },
              { type: "image", image: new URL(signed.signedUrl) },
            ],
          },
        ],
      });
      out = r.output;
    } catch {
      return { verified: false, reason: "Automatic check couldn't run — staff will review your ID." };
    }

    const fail = (reason: string) => ({ verified: false, reason });
    if (!out.isGovernmentId || !out.legible) return fail("We couldn't read a valid photo ID. Retake it in good light with all four corners showing.");
    if (out.expired) return fail("That ID looks expired. Upload a current one.");
    if (out.dateOfBirth !== p.date_of_birth) return fail("The date of birth on your ID doesn't match your profile. Staff will review it.");
    const idWords = norm(out.fullName);
    const prof = norm(p.legal_name);
    const first = prof[0], last = prof[prof.length - 1];
    if (!idWords.includes(first) || !idWords.includes(last)) return fail("The name on your ID doesn't match your profile. Staff will review it.");
    if (ageOn(p.date_of_birth) < 18) return fail("You must be 18 or older.");

    await supabaseAdmin
      .from("profiles")
      .update({ age_verified: true, age_verified_at: new Date().toISOString() })
      .eq("id", userId);
    await supabaseAdmin.from("admin_actions").insert({
      admin_id: userId, action: "auto_id_verified", target_user_id: userId, note: "Photo ID matched name and DOB",
    });
    return { verified: true, reason: "ID matched — you're 18+ verified and paid matches are unlocked." };
  });
