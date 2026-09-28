import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Coins, MapPin, RefreshCw, Trophy, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { trackEvent } from "@/lib/analytics";
import { getRates, refreshRates } from "@/lib/currency";

const PATH = "/play-darts-online-uk-ireland-sweden";
const TITLE = "Play Darts Online in the UK, Ireland & Sweden — SMYD";
const DESC =
  "Play plastic-tip darts online with your GranBoard from the United Kingdom, Ireland or Sweden. 1v1 skill matches in 501 and Cricket for real cash prizes, with amounts shown in £, € or kr.";

export const Route = createFileRoute("/play-darts-online-uk-ireland-sweden")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "article" },
      { property: "og:url", content: `https://smyd.online${PATH}` },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: `https://smyd.online${PATH}` }],
  }),
  component: InternationalLanding,
});

const COUNTRIES = [
  {
    code: "GB",
    name: "United Kingdom",
    currency: "GBP",
    symbol: "£",
    blurb: "Play darts online from anywhere in the UK — England, Scotland, Wales and Northern Ireland.",
  },
  {
    code: "IE",
    name: "Ireland",
    currency: "EUR",
    symbol: "€",
    blurb: "Open across the Republic of Ireland — play 1v1 GranBoard matches from home.",
  },
  {
    code: "SE",
    name: "Sweden",
    currency: "SEK",
    symbol: "kr",
    blurb: "Full access across Sweden — matches, the monthly tournament and fast cash-outs.",
  },
];

const FAQS = [
  {
    q: "Can I play SMYD in the UK, Ireland or Sweden?",
    a: "Yes. SMYD is open across the whole of the United Kingdom, Ireland and Sweden — there are no region-by-region restrictions like the US states. You must be 18 or over and verify your age with a photo ID.",
  },
  {
    q: "What currency are prizes paid in?",
    a: "All balances, entries and prizes are in US dollars. To make things clear, every dollar amount is also shown with an approximate equivalent in pounds (£), euros (€) or kronor (kr) at the current exchange rate.",
  },
  {
    q: "How do I cash out?",
    a: "Cash-outs go to your PayPal or Venmo account, in US dollars, with a $5 minimum. PayPal and Venmo convert to your local currency when the money arrives. A 72-hour security hold applies to cash-outs.",
  },
  {
    q: "What do I need to play?",
    a: "A GranBoard (plastic-tip / soft tip board), a phone or camera that shows the whole board from more than 8 feet away, and a free SMYD account. Matches are 1v1 contests of skill in 501 or Cricket.",
  },
  {
    q: "Can I enter the $500 monthly tournament?",
    a: "Yes — SMYD Pro members ($19.99/month) in the UK, Ireland and Sweden can enter the monthly GranBoard tournament, a 16-player draw with a $500 prize.",
  },
  {
    q: "Is there a bonus for new players?",
    a: "Yes — new players get a 20% bonus on their first deposit. A disclosed service fee applies to paid entries, and the fee is refunded if a match is cancelled or declined.",
  },
];

function usd(cents: number, currency: string, symbol: string, rates: Record<string, number>) {
  const local = (cents / 100) * (rates[currency] ?? 1);
  return `$${(cents / 100).toFixed(2)} ≈ ${symbol}${local.toFixed(2)}`;
}

function SignUp() {
  return (
    <Link
      to="/login"
      onClick={() => trackEvent("howto_signup_click", PATH)}
      className="inline-flex w-full items-center justify-center rounded-xl bg-primary px-6 py-4 font-display text-lg font-bold text-primary-foreground shadow-lg transition hover:opacity-90"
    >
      Sign up free & play
    </Link>
  );
}

function InternationalLanding() {
  const [rates, setRates] = useState<Record<string, number>>(getRates());
  useEffect(() => {
    refreshRates().then(() => setRates({ ...getRates() }));
  }, []);

  return (
    <AppShell>
      <article className="px-5 py-6 space-y-6 animate-fade-in-up">
        <header className="space-y-3">
          <h1 className="font-display text-3xl font-bold leading-tight">
            Play darts online in the UK, Ireland &amp; Sweden
          </h1>
          <p className="text-muted-foreground">
            SMYD is a plastic-tip (soft tip) darts platform — play 1v1 GranBoard matches in 501 and Cricket
            from home, for real cash prizes decided by skill, not luck.
          </p>
          <SignUp />
        </header>

        <section className="rounded-xl bg-surface ring-1 ring-border p-4 space-y-3">
          <h2 className="font-display text-xl font-bold flex items-center gap-2">
            <MapPin className="size-5 text-primary" /> Where you're playing from
          </h2>
          <ul className="space-y-2">
            {COUNTRIES.map((c) => (
              <li key={c.code} className="rounded-lg bg-background ring-1 ring-border px-3 py-2 text-sm">
                <span className="font-semibold">{c.name}</span>
                <span className="text-muted-foreground"> — {c.blurb}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl bg-surface ring-1 ring-border p-4 space-y-3">
          <h2 className="font-display text-xl font-bold flex items-center gap-2">
            <Coins className="size-5 text-accent" /> Your currency, at today's rate
          </h2>
          <p className="text-sm text-muted-foreground">
            Balances and prizes are in US dollars, and every amount also shows an approximate local
            equivalent. Here's what typical amounts look like right now:
          </p>
          <div className="overflow-hidden rounded-lg ring-1 ring-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-background text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-semibold">Amount</th>
                  {COUNTRIES.map((c) => (
                    <th key={c.code} className="px-3 py-2 font-semibold">{c.symbol}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[500, 2000, 5000].map((cents) => (
                  <tr key={cents} className="border-t border-border">
                    <td className="px-3 py-2 font-semibold">${(cents / 100).toFixed(2)}</td>
                    {COUNTRIES.map((c) => (
                      <td key={c.code} className="px-3 py-2 text-muted-foreground">
                        {usd(cents, c.currency, c.symbol, rates).split("≈ ")[1]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <RefreshCw className="size-3" /> Approximate conversions at the current exchange rate; dollar amounts are exact.
          </p>
        </section>

        <section className="rounded-xl bg-surface ring-1 ring-border p-4 space-y-2">
          <h2 className="font-display text-xl font-bold flex items-center gap-2">
            <Trophy className="size-5 text-accent" /> $500 monthly GranBoard tournament
          </h2>
          <p className="text-sm text-muted-foreground">
            SMYD Pro members ($19.99/month) can enter the monthly tournament — a 16-player draw in 501 and
            Cricket with a $500 prize ({usd(50000, "GBP", "£", rates).split("≈ ")[1]} /{" "}
            {usd(50000, "EUR", "€", rates).split("≈ ")[1]} / {usd(50000, "SEK", "kr", rates).split("≈ ")[1]}).
          </p>
          <Link
            to="/monthly-tournament"
            className="inline-flex w-full items-center justify-center rounded-xl bg-primary/15 px-4 py-3 text-sm font-bold text-primary ring-1 ring-primary/40"
          >
            See the GranBoard tournament
          </Link>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold flex items-center gap-2">
            <Users className="size-5 text-primary" /> Questions from UK, Irish &amp; Swedish players
          </h2>
          <div className="space-y-2">
            {FAQS.map((f) => (
              <details key={f.q} className="rounded-xl bg-surface ring-1 ring-border p-4 group">
                <summary className="cursor-pointer font-semibold text-sm group-open:mb-2">{f.q}</summary>
                <p className="text-sm text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <SignUp />
        <p className="text-center text-xs text-muted-foreground">
          See the <Link to="/rules" className="underline">Competition Rules</Link>,{" "}
          <Link to="/terms" className="underline">Terms</Link> and{" "}
          <Link to="/how-to-play-darts-online" className="underline">How to play darts online</Link>.
        </p>
      </article>
    </AppShell>
  );
}
