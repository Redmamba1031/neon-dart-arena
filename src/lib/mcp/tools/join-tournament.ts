import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "join_tournament",
  title: "Join tournament",
  description: "Enter the signed-in player into an open SMYD tournament. Deducts the entry fee in coins.",
  inputSchema: { tournament_id: z.string().describe("Tournament UUID to join.") },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ tournament_id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { error } = await supabase.rpc("join_tournament", { _tournament_id: tournament_id });
    return error
      ? { content: [{ type: "text", text: error.message }], isError: true }
      : { content: [{ type: "text", text: `Joined tournament ${tournament_id}.` }] };
  },
});
