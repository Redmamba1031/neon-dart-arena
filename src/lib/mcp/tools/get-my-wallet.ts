import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_my_wallet",
  title: "Get my wallet",
  description: "Get the signed-in player's SMYD cash balance and recent wallet transactions.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const [wallet, txns] = await Promise.all([
      supabase.from("wallets").select("*").eq("user_id", ctx.getUserId()!).maybeSingle(),
      supabase
        .from("wallet_transactions")
        .select("*")
        .eq("user_id", ctx.getUserId()!)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    const error = wallet.error ?? txns.error;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const balance_usd = (Number(wallet.data?.balance_cents ?? 0) / 100).toFixed(2);
    const payload = { balance_usd, wallet: wallet.data, transactions: txns.data ?? [] };
    return {
      content: [{ type: "text", text: JSON.stringify(payload) }],
      structuredContent: payload,
    };
  },
});
