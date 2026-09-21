import { createFileRoute } from "@tanstack/react-router";
import { runDuePayouts } from "@/lib/payouts.server";

export const Route = createFileRoute("/api/public/payouts/run")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["PAYOUT_RUNNER_SECRET"];
        const provided = request.headers.get("x-payout-secret");
        if (!secret || !provided || provided !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }
        try {
          const result = await runDuePayouts(25);
          return Response.json(result, { headers: { "Cache-Control": "no-store" } });
        } catch (e) {
          console.error("payout run failed", e);
          return Response.json(
            { error: (e as { message?: string })?.message ?? "Payout run failed" },
            { status: 500 },
          );
        }
      },
    },
  },
});
