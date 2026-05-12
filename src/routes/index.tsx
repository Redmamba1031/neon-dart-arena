import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { MatchCard } from "@/components/MatchCard";
import { liveMatches } from "@/lib/mock-data";
import { Plus, Zap, Trophy, History, MessageSquare, Flame } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lobby — SMYD" },
      { name: "description", content: "Your darts arena. Live matches, wallet, and quick play." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  return (
    <AppShell>
      {/* Live matches */}
      <section className="px-5 py-6 animate-fade-in-up">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Live Matches
          </h2>
          <span className="size-2 animate-pulse rounded-full bg-destructive shadow-[0_0_8px_rgb(239,68,68)]" />
        </div>
        <div className="-mx-5 flex gap-4 overflow-x-auto px-5 no-scrollbar snap-x">
          {liveMatches.map((m) => (
            <div key={m.id} className="snap-center"><MatchCard match={m} /></div>
          ))}
        </div>
      </section>

      {/* Hero CTA */}
      <section className="px-5 mb-6 animate-fade-in-up">
        <Link
          to="/create-match"
          className="block w-full rounded-2xl bg-gradient-neon p-[1px] ring-purple"
        >
          <div className="rounded-2xl bg-background/80 p-5 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                Step up
              </p>
              <p className="font-display text-2xl font-semibold leading-tight">
                Create a Match
              </p>
              <p className="text-xs text-muted-foreground mt-1">501 or Cricket • Set your stake</p>
            </div>
            <div className="size-12 rounded-xl bg-gradient-neon grid place-items-center text-background ring-neon">
              <Plus className="size-6" strokeWidth={2.5} />
            </div>
          </div>
        </Link>
      </section>

      {/* Quick actions */}
      <section className="px-5 grid grid-cols-2 gap-3 mb-6">
        <QuickAction to="/join-match" icon={Zap} label="Quick Join" tint="primary" />
        <QuickAction to="/leaderboard" icon={Trophy} label="Leaderboard" tint="accent" />
        <QuickAction to="/history" icon={History} label="History" tint="muted" />
        <QuickAction to="/profile" icon={Flame} label="My Streak" tint="primary" />
      </section>

      {/* Discord */}
      <section className="px-5 mb-6">
        <a
          href="https://discord.gg/lovable-dev"
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-3 w-full rounded-xl bg-discord/10 ring-1 ring-discord/30 py-4 transition-colors hover:bg-discord/20"
        >
          <MessageSquare className="size-4 text-discord" />
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-discord">
            Join Discord Community
          </span>
        </a>
      </section>

      {/* Stats */}
      <section className="px-5 grid grid-cols-3 gap-3">
        <Stat label="Rank" value="#1,402" />
        <Stat label="Win Rate" value="68%" tint="primary" />
        <Stat label="Streak" value="8🔥" tint="accent" />
      </section>
    </AppShell>
  );
}

function QuickAction({
  to, icon: Icon, label, tint,
}: { to: string; icon: React.ElementType; label: string; tint: "primary" | "accent" | "muted" }) {
  const tintClass =
    tint === "primary" ? "text-primary" : tint === "accent" ? "text-accent" : "text-muted-foreground";
  return (
    <Link
      to={to}
      className="flex h-16 items-center gap-3 rounded-xl bg-surface px-4 ring-1 ring-border transition-transform active:scale-[0.97] hover:ring-primary/30"
    >
      <div className={`size-8 grid place-items-center rounded-lg bg-background ${tintClass}`}>
        <Icon className="size-4" />
      </div>
      <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
    </Link>
  );
}

function Stat({ label, value, tint }: { label: string; value: string; tint?: "primary" | "accent" }) {
  const tintClass = tint === "primary" ? "text-primary" : tint === "accent" ? "text-accent" : "text-foreground";
  return (
    <div className="rounded-xl bg-surface p-4 ring-1 ring-border">
      <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display text-xl font-semibold ${tintClass}`}>{value}</p>
    </div>
  );
}
