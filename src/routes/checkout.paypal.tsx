import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { capturePaypalDeposit } from "@/lib/paypal-deposit.functions";
import { formatMoney } from "@/lib/api";

export const Route = createFileRoute("/checkout/paypal")({
  validateSearch: (s: Record<string, unknown>): { token?: string } => ({
    token: typeof s.token === "string" ? s.token : undefined,
  }),
  head: () => ({
    meta: [
      { title: "PayPal payment — SMYD" },
      { name: "description", content: "Finishing your PayPal deposit to SMYD." },
      { property: "og:title", content: "PayPal payment — SMYD" },
      { property: "og:description", content: "Finishing your PayPal deposit to SMYD." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaypalReturn,
});

function PaypalReturn() {
  const { token } = Route.useSearch();
  const capture = useServerFn(capturePaypalDeposit);
  const qc = useQueryClient();
  const ran = useRef(false);
  const [state, setState] = useState<{ status: "working" | "done" | "error"; msg?: string }>({ status: "working" });

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    if (!token) { setState({ status: "error", msg: "No PayPal payment found." }); return; }
    capture({ data: { orderId: token } })
      .then((r) => {
        if ("error" in r && r.error) setState({ status: "error", msg: r.error });
        else {
          setState({ status: "done", msg: `${formatMoney((r as { amountCents: number }).amountCents)} added to your account.` });
          qc.invalidateQueries();
        }
      })
      .catch((e) => setState({ status: "error", msg: e instanceof Error ? e.message : "Something went wrong" }));
  }, [token, capture, qc]);

  return (
    <AppShell>
      <div className="px-5 py-12 text-center space-y-4 animate-fade-in-up">
        {state.status === "working" && <Loader2 className="size-16 mx-auto animate-spin text-primary" />}
        {state.status === "done" && <CheckCircle2 className="size-16 mx-auto text-success" />}
        {state.status === "error" && <XCircle className="size-16 mx-auto text-destructive" />}
        <h1 className="font-display text-3xl font-bold">
          {state.status === "working" ? "Finishing payment…" : state.status === "done" ? "Payment complete" : "Payment problem"}
        </h1>
        {state.msg && <p className="text-muted-foreground text-sm">{state.msg}</p>}
        {state.status !== "working" && (
          <Link to="/shop" className="inline-block rounded-xl bg-primary px-6 py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground">
            Back to Cashier
          </Link>
        )}
      </div>
    </AppShell>
  );
}
