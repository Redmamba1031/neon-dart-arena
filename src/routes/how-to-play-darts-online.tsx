import { createFileRoute, Link } from "@tanstack/react-router";
import { Camera, MapPin, Target, Trophy, UserCheck, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";

const TITLE = "How to Play Darts Online for Real Prizes — SMYD";
const DESC =
  "Play darts online with your GranBoard: 1v1 skill matches in 501 and Cricket for real cash prizes. Open in Indiana, Texas, Colorado, Kansas, Missouri and Wisconsin.";

export const Route = createFileRoute("/how-to-play-darts-online")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "https://smyd.online/how-to-play-darts-online" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://smyd.online/how-to-play-darts-online" }],
  }),
  component: HowToPlay,
});

const STATES = ["Indiana", "Texas", "Colorado", "Kansas", "Missouri", "Wisconsin"];

const STEPS = [
  { icon: UserCheck, t: "Create your free account", d: "Sign up with your real name and date of birth, then verify your age with a photo ID. You must be 18+." },
  { icon: Target, t: "Set up your GranBoard", d: "Connect your GranBoard and mount a camera that shows the whole board from more than 8 feet away." },
  { icon: Users, t: "Find an opponent", d: "Join the SMYD GranBoard group to line up a match, then create or join it in SMYD." },
  { icon: Trophy, t: "Play 501 or Cricket", d: "Play your 1v1 skill match. Both players report the winner within the 2-hour window and the winner is paid automatically." },
];

function SignUp() {
  return (
    <Link
      to="/login"
      className="inline-flex w-full items-center justify-center rounded-xl bg-primary px-6 py-4 font-display text-lg font-bold text-primary-foreground shadow-lg transition hover:opacity-90"
    >
      Sign up free & play
    </Link>
  );
}

function HowToPlay() {
  return (
    <AppShell>
      <article className="px-5 py-6 space-y-6 animate-fade-in-up">
        <header className="space-y-3">
          <h1 className="font-display text-3xl font-bold leading-tight">How to play darts online</h1>
          <p className="text-muted-foreground">
            SMYD lets you play steel-tip style darts online against real people from home. Use your GranBoard,
            pick 501 or Cricket, and compete in 1v1 skill matches for real cash prizes.
          </p>
          <SignUp />
        </header>

        <section className="rounded-xl bg-surface ring-1 ring-border p-4 space-y-3">
          <h2 className="font-display text-xl font-bold flex items-center gap-2">
            <MapPin className="size-5 text-primary" /> Where you can play
          </h2>
          <p className="text-sm text-muted-foreground">Cash matches are open to players located in:</p>
          <ul className="grid grid-cols-2 gap-2">
            {STATES.map((s) => (
              <li key={s} className="rounded-lg bg-background ring-1 ring-border px-3 py-2 text-sm font-semibold">{s}</li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">Your location is checked before every paid match.</p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold">Getting started in 4 steps</h2>
          <ol className="space-y-3">
            {STEPS.map((s, i) => (
              <li key={s.t} className="flex gap-3 rounded-xl bg-surface ring-1 ring-border p-4">
                <div className="size-10 shrink-0 rounded-lg bg-primary/15 grid place-items-center text-primary">
                  <s.icon className="size-5" />
                </div>
                <div>
                  <h3 className="font-semibold">{i + 1}. {s.t}</h3>
                  <p className="text-sm text-muted-foreground">{s.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="rounded-xl bg-surface ring-1 ring-border p-4 space-y-2">
          <h2 className="font-display text-xl font-bold flex items-center gap-2">
            <Camera className="size-5 text-accent" /> Fair play
          </h2>
          <p className="text-sm text-muted-foreground">
            Matches are contests of skill. Your camera must show the board clearly, and false winner reports lead
            to a permanent ban. A disclosed service fee applies to paid entries. New players get a 20% bonus on
            their first deposit.
          </p>
        </section>

        <SignUp />
        <p className="text-center text-xs text-muted-foreground">
          See the <Link to="/rules" className="underline">Competition Rules</Link> and{" "}
          <Link to="/terms" className="underline">Terms</Link>.
        </p>
      </article>
    </AppShell>
  );
}
