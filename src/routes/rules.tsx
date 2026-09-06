import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/rules")({
  head: () => ({
    meta: [
      { title: "Competition Rules — SMYD" },
      { name: "description", content: "Official SMYD competition rules: reporting windows, camera requirements, disputes, and fair play." },
      { property: "og:title", content: "Competition Rules — SMYD" },
      { property: "og:description", content: "Official SMYD competition rules for 1v1 darts matches." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RulesPage,
});

function Rule({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-surface p-4 ring-1 ring-border">
      <h2 className="flex items-center gap-2 font-display text-sm font-bold">
        <span className="grid size-6 place-items-center rounded-md bg-primary/15 font-display text-[11px] font-bold text-primary">{n}</span>
        {title}
      </h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function RulesPage() {
  return (
    <AppShell>
      <div className="space-y-5 px-5 py-6">
        <div>
          <h1 className="font-display text-2xl font-bold">Competition Rules</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            These rules apply to every match on SMYD and are part of the{" "}
            <Link to="/terms" className="text-primary underline">Terms of Service</Link>.
          </p>
        </div>

        <Rule n="1" title="Stakes & the house fee">
          <p>
            Both players put up the agreed stake when the match starts. Stakes are held until the result is
            confirmed. The winner receives the pot minus a 10% house fee. Minimum stake is $5.00.
          </p>
        </Rule>

        <Rule n="2" title="Game formats">
          <p>
            Matches are played on your own boards — 501, Cricket, Medley, or Piddle, with the options shown
            on the match (Double In, finish rule, best-of legs). SMYD does not score your game in-app; you
            play it live and report the winner.
          </p>
        </Rule>

        <Rule n="3" title="Reporting the winner — 45 minutes">
          <p>
            You have <span className="font-semibold text-foreground">45 minutes</span> from the start of the
            match to post the winner. Both players must report. When both report the same winner, the funds
            are released immediately.
          </p>
          <p>
            If your opponent never reports, you can claim the result once the 45 minutes are up.
          </p>
        </Rule>

        <Rule n="4" title="Camera rule">
          <p>
            Your camera must show the full board from more than{" "}
            <span className="font-semibold text-foreground">8 feet away</span> for the entire match. If your
            opponent flags you for a camera violation and proves it with evidence, you take an{" "}
            <span className="font-semibold text-foreground">automatic loss</span>.
          </p>
        </Rule>

        <Rule n="5" title="Disputes">
          <p>
            If the two players report different winners, the match is flagged as disputed and the funds stay
            held. SMYD staff review the match and any submitted evidence, then settle it to the rightful
            winner. Staff decisions on disputes are final.
          </p>
        </Rule>

        <Rule n="6" title="Fair play & bans">
          <p>
            Posting a false winner, colluding with your opponent, using multiple accounts, or any form of
            cheating results in a <span className="font-semibold text-foreground">permanent ban</span> from
            SMYD. Banned players cannot create or join matches, accept challenges, or redeem gift cards, and
            funds may be held pending investigation.
          </p>
        </Rule>

        <div className="flex items-start gap-2 rounded-xl bg-destructive/10 p-4 text-xs text-destructive ring-1 ring-destructive/40">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>
            By entering a match you agree to every rule on this page. If you have a rules question before
            playing, contact <a href="mailto:redmond1031@gmail.com" className="font-semibold underline">redmond1031@gmail.com</a>.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
