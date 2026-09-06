import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/refunds")({
  head: () => ({
    meta: [
      { title: "Refund & Cancellation Policy — SMYD" },
      { name: "description", content: "SMYD's refund and cancellation policy for deposits, match stakes, gift cards, and withdrawals." },
      { property: "og:title", content: "Refund & Cancellation Policy — SMYD" },
      { property: "og:description", content: "How refunds and cancellations work on SMYD." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RefundsPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-display text-sm font-bold uppercase tracking-[0.2em] text-primary">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function RefundsPage() {
  return (
    <AppShell>
      <div className="space-y-8 px-5 py-6">
        <div>
          <h1 className="font-display text-2xl font-bold">Refund & Cancellation Policy</h1>
          <p className="mt-1 text-xs text-muted-foreground">Last updated: September 2026</p>
        </div>

        <Section title="Deposits">
          <p>
            Funds you add to your account are available to play with immediately. Unused funds are never
            "spent" — you can always withdraw your remaining balance to PayPal, Cash App, or Venmo instead
            of requesting a refund. If a deposit fails but your card was charged, contact support and we
            will credit or refund it.
          </p>
        </Section>

        <Section title="Match stakes">
          <ul className="list-disc space-y-1 pl-5">
            <li>Cancel a match before anyone joins and your full stake is returned instantly.</li>
            <li>If a challenge is declined, the creator's stake is refunded in full.</li>
            <li>Once a match is live, stakes are held until the result is confirmed — they cannot be withdrawn mid-match.</li>
            <li>Disputed matches stay held until staff review. The winner of the review receives the pot (minus the house fee); there are no partial refunds on completed matches.</li>
          </ul>
        </Section>

        <Section title="Gift cards">
          <p>
            Gift card redemptions are final once the card is delivered. If a redemption fails and no card is
            delivered, the funds are automatically returned to your SMYD balance — if yours wasn't, contact
            support or ask staff to refund the order from the admin panel.
          </p>
        </Section>

        <Section title="Withdrawals">
          <p>
            Pending withdrawal requests can be rejected by staff, in which case the full amount is returned
            to your balance. Once a payout has been sent to your PayPal, Cash App, or Venmo account it
            cannot be reversed by SMYD.
          </p>
        </Section>

        <Section title="Bans">
          <p>
            Accounts banned for cheating or false reporting may have funds held or forfeited after review,
            as described in the Terms of Service.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            For any refund question, email{" "}
            <a href="mailto:redmond1031@gmail.com" className="text-primary underline">redmond1031@gmail.com</a>{" "}
            with your username and the transaction in question.
          </p>
        </Section>
      </div>
    </AppShell>
  );
}
