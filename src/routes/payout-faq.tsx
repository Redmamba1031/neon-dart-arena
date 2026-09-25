import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/payout-faq")({
  head: () => ({
    meta: [
      { title: "Payout FAQ — SMYD" },
      { name: "description", content: "How SMYD cash-outs work: PayPal and Venmo payouts, hold times, fees, and why a payout can fail." },
      { property: "og:title", content: "Payout FAQ — SMYD" },
      { property: "og:description", content: "Payout methods, hold times, fees, and troubleshooting for SMYD cash-outs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PayoutFaqPage,
});

function QA({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-display text-sm font-bold uppercase tracking-[0.2em] text-primary">{q}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function PayoutFaqPage() {
  return (
    <AppShell>
      <div className="space-y-8 px-5 py-6">
        <div>
          <h1 className="font-display text-2xl font-bold">Payout FAQ</h1>
          <p className="mt-1 text-xs text-muted-foreground">Last updated: September 2026</p>
        </div>

        <QA q="How do I cash out?">
          <p>
            Open the Cashier and choose <strong className="text-foreground">PayPal</strong> or{" "}
            <strong className="text-foreground">Venmo</strong>. Enter your PayPal email or Venmo
            handle and submit the request. The minimum cash-out is $5.00.
          </p>
        </QA>

        <QA q="How long do payouts take?">
          <p>
            Every cash-out sits on a <strong className="text-foreground">72-hour security hold</strong>{" "}
            before it is sent. The hold protects you and other players from fraud — during it your
            request shows as <strong className="text-foreground">Pending</strong>.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong className="text-foreground">PayPal & Venmo:</strong> sent automatically once the hold clears, usually minutes after.</li>
            <li>Payouts flagged for extra review stay on hold until staff approve them.</li>
          </ul>
        </QA>

        <QA q="Are there any fees on payouts?">
          <p>
            SMYD does not charge a fee to cash out — you receive the amount you requested. PayPal
            or Venmo may apply their own standard receiving or transfer fees, which are outside our
            control.
          </p>
        </QA>

        <QA q="Why do payouts sometimes fail?">
          <p>The most common reasons:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>A typo in the PayPal email or Venmo handle, or an account that doesn't match the name on your SMYD profile.</li>
            <li>An unconfirmed PayPal/Venmo account, or one that can't receive payments.</li>
            <li>A review flag — unusually large or rapid requests may be held for staff approval.</li>
          </ul>
          <p>
            When a payout fails it shows as <strong className="text-foreground">Returned</strong> or{" "}
            <strong className="text-foreground">Needs attention</strong> in your Cashier with the
            reason, and the money stays in (or is returned to) your SMYD balance. Fix the destination
            details and request again, or use the "Trouble with a payout?" helper in the Cashier for
            a plain-English explanation.
          </p>
        </QA>

        <QA q="Can I cancel a cash-out?">
          <p>
            While a request is still Pending, staff can reject it and the full amount returns to your
            balance — email us quickly. Once a payout has been sent to PayPal or Venmo it
            cannot be reversed by SMYD.
          </p>
        </QA>

        <QA q="Where does my match prize money go?">
          <p>
            When a match is confirmed, 100% of the prize is credited to your SMYD balance
            instantly. From there it stays available to play with or cash out whenever you like.
          </p>
        </QA>

        <QA q="Still stuck?">
          <p>
            Email{" "}
            <a href="mailto:redmond1031@gmail.com" className="text-primary underline">redmond1031@gmail.com</a>{" "}
            with your username and the payout in question, or visit the{" "}
            <a href="/support" className="text-primary underline">Support page</a>.
          </p>
        </QA>
      </div>
    </AppShell>
  );
}
