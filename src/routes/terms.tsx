import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — SMYD" },
      { name: "description", content: "The terms that govern your use of SMYD, the skill-based darts competition app." },
      { property: "og:title", content: "Terms of Service — SMYD" },
      { property: "og:description", content: "The terms that govern your use of SMYD." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TermsPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-display text-sm font-bold uppercase tracking-[0.2em] text-primary">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function TermsPage() {
  return (
    <AppShell>
      <div className="space-y-8 px-5 py-6">
        <div>
          <h1 className="font-display text-2xl font-bold">Terms of Service</h1>
          <p className="mt-1 text-xs text-muted-foreground">Last updated: September 2026</p>
        </div>

        <Section title="The service">
          <p>
            SMYD™ (Show Me Your Darts) is a platform for skill-based darts competitions. Players match up,
            play their game on their own board, and report the result. Each player pays a fixed entry that
            is split into a prize contribution and a disclosed SMYD service fee. The prize contributions
            form the prize, and 100% of the prize is awarded to the winner. Outcomes are determined
            solely by the players' darts performance — SMYD is a contest of skill, not gambling.
          </p>
        </Section>

        <Section title="Eligibility">
          <ul className="list-disc space-y-1 pl-5">
            <li>You must be at least 18 years old (or the age of majority where you live).</li>
            <li>You may have only one account. Duplicate accounts may be banned and funds forfeited.</li>
            <li>You are responsible for confirming that skill-based cash competitions are legal where you live before playing for money.</li>
          </ul>
        </Section>

        <Section title="Your account">
          <p>
            Keep your login credentials private. You are responsible for activity on your account. We may
            suspend or ban accounts that break the competition rules, abuse other players, commit fraud, or
            manipulate results. Banned accounts lose access to matchmaking and withdrawals, and funds may be
            held pending investigation.
          </p>
        </Section>

        <Section title="Funds and payouts">
          <ul className="list-disc space-y-1 pl-5">
            <li>Account funds are added at face value ($25 in = $25 on your account) and can be used to enter matches or withdrawn.</li>
            <li>Withdrawals are subject to a $5.00 minimum and are sent to the PayPal, Venmo, or bank account you provide.</li>
            <li>Match entries are held when a match starts and the full prize is released to the winner once the result is confirmed.</li>
            <li>Each entry includes a disclosed 10% SMYD service fee, shown before you confirm. No fee is taken out of the prize.</li>
          </ul>
        </Section>

        <Section title="Fair play">
          <p>
            All matches are governed by the{" "}
            <Link to="/rules" className="text-primary underline">Competition Rules</Link>, which are part of
            these terms. Posting a false result, colluding, or violating the camera rule can result in an
            automatic loss and a permanent ban.
          </p>
        </Section>

        <Section title="Intellectual property">
          <p>
            SMYD™ and the SMYD logo are trademarks of SMYD's owner. The app, its source code, design, and
            content are the owner's intellectual property. You may not copy, resell, or reuse any part of
            the service without written permission.
          </p>
        </Section>

        <Section title="Limitation of liability">
          <p>
            The service is provided "as is". To the maximum extent permitted by law, SMYD is not liable for
            indirect or consequential damages, and our total liability is limited to the balance held in
            your account.
          </p>
        </Section>

        <Section title="Changes">
          <p>
            We may update these terms from time to time. Continued use of SMYD after changes take effect
            means you accept the updated terms.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Email <a href="mailto:redmond1031@gmail.com" className="text-primary underline">redmond1031@gmail.com</a> with any questions about these terms.
          </p>
        </Section>
      </div>
    </AppShell>
  );
}
