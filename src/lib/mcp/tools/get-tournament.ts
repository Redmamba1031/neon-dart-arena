import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_tournament",
  title: "Get tournament",
  description: "Get one SMYD tournament with its participants and bracket matches.",
  inputSchema: { tournament_id: z.string().describe("Tournament UUID.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ tournament_id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const [t, parts, matches] = await Promise.all([
      supabase.from("tournaments").select("*").eq("id", tournament_id).maybeSingle(),
      supabase.from("tournament_participants").select("*").eq("tournament_id", tournament_id),
      supabase.from("tournament_matches").select("*").eq("tournament_id", tournament_id).order("round").order("slot"),
    ]);
    const error = t.error ?? parts.error ?? matches.error;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!t.data) return { content: [{ type: "text", text: "Tournament not found" }], isError: true };
    const payload = {
      tournament: t.data,
      participants: parts.data ?? [],
      matches: matches.data ?? [],
    };
    return {
      content: [{ type: "text", text: JSON.stringify(payload) }],
      structuredContent: payload,
    };
  },
});
