import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — SMYD" },
      { name: "description", content: "How SMYD collects, uses, and protects your personal information and account data." },
      { property: "og:title", content: "Privacy Policy — SMYD" },
      { property: "og:description", content: "How SMYD collects, uses, and protects your personal information." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-display text-sm font-bold uppercase tracking-[0.2em] text-primary">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function PrivacyPage() {
  return (
    <AppShell>
      <div className="space-y-8 px-5 py-6">
        <div>
          <h1 className="font-display text-2xl font-bold">Privacy Policy</h1>
          <p className="mt-1 text-xs text-muted-foreground">Last updated: September 2026</p>
        </div>

        <Section title="What we collect">
          <p>When you use SMYD (Show Me Your Darts), we collect:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Account information — email address, username, display name, and avatar.</li>
            <li>Match and game data — matches you create or join, stakes, results you report, wins and losses, and leaderboard stats.</li>
            <li>Wallet and payment data — account balance, transaction history, gift card redemptions, and withdrawal requests. Card payments are processed by our payment processor; SMYD does not store full card numbers.</li>
            <li>Messages — in-app messages you send to other players.</li>
            <li>Basic usage data — device and log information needed to run and secure the service.</li>
          </ul>
        </Section>

        <Section title="How we use it">
          <ul className="list-disc space-y-1 pl-5">
            <li>Run matches, wagers, payouts, leaderboards, and gift card redemptions.</li>
            <li>Prevent fraud, cheating, and abuse, including reviewing disputed matches and enforcing bans.</li>
            <li>Communicate with you about your account, transactions, and support requests.</li>
            <li>Comply with legal obligations related to payments and skill-based competition.</li>
          </ul>
        </Section>

        <Section title="What we share">
          <p>
            Other players can see your username, display name, avatar, match history, and leaderboard stats.
            We share payment details only with the processors needed to complete your transaction (for example
            our card processor for deposits and gift card providers for redemptions). We do not sell your
            personal information.
          </p>
        </Section>

        <Section title="Match evidence">
          <p>
            If a match is disputed or a camera-rule violation is flagged, we may ask players to submit video
            or photo evidence of the match. This evidence is used only to resolve that dispute and enforce
            the competition rules.
          </p>
        </Section>

        <Section title="Your choices">
          <p>
            You can update your profile details at any time from your profile page. You may request deletion
            of your account by contacting support; we may retain transaction records where required for
            financial and legal reasons.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about this policy? Email <a href="mailto:support@smyd.online" className="text-primary underline">support@smyd.online</a>.
          </p>
        </Section>
      </div>
    </AppShell>
  );
}
