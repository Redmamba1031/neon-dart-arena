import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () => {
        const started = Date.now();
        let database: "ok" | "error" = "ok";
        let detail: string | null = null;

        try {
          const url = process.env["SUPABASE_URL"];
          const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
          if (!url || !key) throw new Error("Backend not configured");
          const client = createClient(url, key, {
            auth: { persistSession: false, autoRefreshToken: false },
            global: {
              fetch: (input, init) => {
                const h = new Headers(init?.headers);
                if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
                h.set("apikey", key);
                return fetch(input, { ...init, headers: h });
              },
            },
          });
          const { error } = await client.from("coin_packs").select("price_id").limit(1);
          if (error) throw error;
        } catch (e) {
          database = "error";
          detail = (e as { message?: string })?.message ?? "unknown error";
        }

        const body = {
          status: database === "ok" ? "ok" : "degraded",
          database,
          detail,
          latency_ms: Date.now() - started,
          time: new Date().toISOString(),
        };

        return new Response(JSON.stringify(body), {
          status: database === "ok" ? 200 : 503,
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
