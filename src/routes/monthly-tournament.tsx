import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { Crown, Target, Trophy, Users, Video, X, CheckCircle2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createMembershipCheckout } from "@/lib/membership.functions";

const TITLE = "GranBoard Tournaments — SMYD";
const DESC =
  "Enter SMYD's monthly GranBoard tournament — a $500 501 & Cricket bracket for up to 16 Pro members, played from home. Open in IN, TX, CO, KS, MO and WI.";

export const Route = createFileRoute("/monthly-tournament")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://smyd.online/monthly-tournament" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://smyd.online/monthly-tournament" }],
  }),
  component: TournamentPage,
});

type Membership = { status: string; current_period_end: string | null; cancel_at_period_end: boolean };

function useMembership() {
  return useQuery({
    queryKey: ["membership"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await (supabase.from("memberships" as any) as any)
        .select("status, current_period_end, cancel_at_period_end")
        .eq("user_id", u.user.id)
        .maybeSingle();
      return (data ?? null) as Membership | null;
    },
  });
}

function useSignedIn() {
  return useQuery({
    queryKey: ["signed-in"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return !!data.user;
    },
  });
}

function isActive(m: Membership | null | undefined) {
  if (!m) return false;
  const future = !m.current_period_end || new Date(m.current_period_end) > new Date();
  if (["active", "trialing", "past_due"].includes(m.status)) return future;
  return m.status === "canceled" && !!m.current_period_end && future;
}

const FAQ = [
  {
    q: "How often does SMYD run GranBoard tournaments?",
    a: "Every month. Each cycle is a single-elimination bracket on GranBoard with a $500 prize for the champion.",
  },
  {
    q: "Who can enter?",
    a: "SMYD Pro members ($19.99/month) who are 18 or older, age-verified with a photo ID, and located in Indiana, Texas, Colorado, Kansas, Missouri or Wisconsin.",
  },
  {
    q: "How does the 16-player draw work?",
    a: "Up to 16 active Pro members are drawn at random for that month's bracket. The draw only decides who plays — pairings and schedules are posted in the SMYD group on GranBoard.",
  },
  {
    q: "How is each round played and reported?",
    a: "Rounds are played live on camera under the same rules as regular matches: the board must be visible from more than 8 feet away, and both players report the winner within the 2-hour window. False winner reports lead to a permanent ban.",
  },
  {
    q: "How is the $500 paid?",
    a: "The prize is credited to the champion's SMYD balance and can be withdrawn to the PayPal or Venmo account on file, subject to the normal minimum cash-out.",
  },
];

function TournamentPage() {
  const { data: membership } = useMembership();
  const { data: signedIn } = useSignedIn();
  const [open, setOpen] = useState(false);
  const active = isActive(membership);

  const fetchClientSecret = async () => {
    const r = await createMembershipCheckout({
      data: {
        returnUrl: `${window.location.origin}/monthly-tournament`,
        environment: getStripeEnvironment(),
      },
    });
    if ("error" in r) throw new Error(r.error);
    return r.clientSecret;
  };

  return (
    <AppShell>
      <div className="space-y-6 px-5 py-6 animate-fade-in-up">
        <section className="rounded-2xl bg-surface p-6 ring-1 ring-primary/40 text-center">
          <Trophy className="mx-auto size-14 text-primary" />
          <p className="mt-3 text-xs font-bold uppercase tracking-[0.2em] text-primary">SMYD Pro on GranBoard</p>
          <h1 className="mt-1 font-display text-4xl font-bold">GranBoard Tournaments</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            SMYD runs a $500 GranBoard tournament every month. Up to 16 SMYD Pro members are drawn for that month's
            bracket, then play head-to-head 501 and Cricket matches on their own GranBoard at home — the champion is
            decided by darts, not luck.
          </p>
          {!signedIn ? (
            <Link
              to="/login"
              className="mt-5 block w-full rounded-xl bg-primary px-6 py-4 font-display text-lg font-bold uppercase tracking-wider text-primary-foreground shadow-lg"
            >
              Sign up free &amp; enter
            </Link>
          ) : active ? (
            <div className="mt-5 inline-flex flex-wrap items-center justify-center gap-2 rounded-xl bg-success/15 px-4 py-3 text-sm font-bold text-success">
              <CheckCircle2 className="size-5" /> You're in — Pro member
              {membership?.current_period_end && (
                <span className="font-normal">
                  {membership.cancel_at_period_end ? "until " : "• renews "}
                  {new Date(membership.current_period_end).toLocaleDateString()}
                </span>
              )}
            </div>
          ) : (
            <button
              onClick={() => setOpen(true)}
              className="mt-5 w-full rounded-xl bg-primary px-6 py-4 font-display text-lg font-bold uppercase tracking-wider text-primary-foreground shadow-lg"
            >
              Join Pro — $19.99/month
            </button>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground">Cancel anytime. Must be 18+, age-verified, and in an eligible state.</p>
        </section>

        <section className="grid grid-cols-2 gap-3">
          {[
            { icon: Crown, t: "$500 prize", d: "Paid to the monthly champion's SMYD balance." },
            { icon: Target, t: "501 & Cricket", d: "Head-to-head tournament rounds played on GranBoard." },
            { icon: Users, t: "16-player draw", d: "Each month, up to 16 active Pro members are drawn at random for the bracket." },
            { icon: Video, t: "Camera rules", d: "Same rules as regular matches — board visible from 8+ feet." },
          ].map(({ icon: I, t, d }) => (
            <div key={t} className="rounded-xl bg-surface p-4 ring-1 ring-border">
              <I className="size-6 text-primary" />
              <h3 className="mt-2 font-display text-sm font-bold">{t}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{d}</p>
            </div>
          ))}
        </section>

        <section className="space-y-2 rounded-xl bg-surface p-4 text-sm text-muted-foreground ring-1 ring-border">
          <h2 className="font-display text-base font-bold text-foreground">How the GranBoard tournament works</h2>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Join SMYD Pro for $19.99/month.</li>
            <li>Each month, up to 16 active members are drawn at random for that month's bracket. The draw only picks who plays — pairings and schedule are posted in the SMYD group on GranBoard.</li>
            <li>Play each round live on camera and report the winner within 2 hours, just like regular matches.</li>
            <li>The last player standing wins $500, credited to their SMYD balance.</li>
          </ol>
          <p className="pt-1 text-xs">
            The monthly draw only decides who enters the bracket — the $500 champion is decided only by play. See the{" "}
            <Link to="/rules" className="text-primary underline">Competition Rules</Link>.
          </p>
        </section>

        <section className="space-y-3 rounded-xl bg-surface p-4 ring-1 ring-border">
          <h2 className="font-display text-base font-bold text-foreground">GranBoard tournament questions</h2>
          {FAQ.map((f) => (
            <div key={f.q}>
              <h3 className="font-display text-sm font-bold text-foreground">{f.q}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{f.a}</p>
            </div>
          ))}
          <p className="pt-1 text-xs text-muted-foreground">
            New to online darts? Read{" "}
            <Link to="/how-to-play-darts-online" className="text-primary underline">how to play darts online</Link>{" "}
            before your first match.
          </p>
        </section>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-background/95 p-4">
          <button onClick={() => setOpen(false)} className="mb-3 ml-auto flex items-center gap-1 text-sm text-muted-foreground">
            <X className="size-4" /> Close
          </button>
          <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </div>
      )}
    </AppShell>
  );
}
