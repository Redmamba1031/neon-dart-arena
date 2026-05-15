import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/checkout/return")({
  validateSearch: (search: Record<string, unknown>): { session_id?: string } => ({
    session_id: typeof search.session_id === "string" ? search.session_id : undefined,
  }),
  head: () => ({ meta: [{ title: "Deposit complete — SMYD" }] }),
  component: CheckoutReturn,
});

function CheckoutReturn() {
  const { session_id } = Route.useSearch();
  return (
    <AppShell>
      <div className="px-5 py-12 text-center space-y-4 animate-fade-in-up">
        <CheckCircle2 className="size-16 mx-auto text-success" />
        <h1 className="font-display text-3xl font-bold">Deposit complete</h1>
        <p className="text-muted-foreground text-sm">
          {session_id
            ? "Your wallet will update within a few seconds."
            : "No session info found."}
        </p>
        <Link
          to="/wallet"
          className="inline-block rounded-xl bg-primary px-6 py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground"
        >
          Back to wallet
        </Link>
      </div>
    </AppShell>
  );
}
