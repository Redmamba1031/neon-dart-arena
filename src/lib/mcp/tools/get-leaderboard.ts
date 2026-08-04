import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_leaderboard",
  title: "Get leaderboard",
  description: "Get the SMYD player leaderboard ranked by total winnings.",
  inputSchema: { limit: z.number().int().optional().describe("Max rows (default 20).") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("leaderboard_view")
      .select("*")
      .order("total_winnings_cents", { ascending: false })
      .limit(Math.min(Math.max(limit ?? 20, 1), 100));
    return error
      ? { content: [{ type: "text", text: error.message }], isError: true }
      : {
          content: [{ type: "text", text: JSON.stringify(data ?? []) }],
          structuredContent: { leaderboard: data ?? [] },
        };
  },
});
