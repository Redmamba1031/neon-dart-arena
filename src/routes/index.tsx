import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Trophy, Flame, MessageSquare, Award, Users, Plus } from "lucide-react";
import { formatUsd, useMyProfile, useTournaments, useIsOwner } from "@/lib/api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lobby — SMYD" },
      { name: "description", content: "Your darts arena. Live tournaments and quick play." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data: tournaments = [] } = useTournaments();
  const { data: me } = useMyProfile();
  const { data: isOwner = false } = useIsOwner();

  const open = tournaments.filter((t) => t.status === "open").slice(0, 6);

  return (
    <AppShell>
      <section className="px-5 py-6 animate-fade-in-up">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Open Tournaments</h2>
          {open.length > 0 && (
            <span className="size-2 animate-pulse rounded-full bg-destructive shadow-[0_0_8px_rgb(239,68,68)]" />
          )}
        </div>
        {open.length === 0 ? (
          <div className="rounded-xl bg-surface ring-1 ring-border p-6 text-center text-sm text-muted-foreground">
            No open tournaments. Create one below.
          </div>
        ) : (
          <div className="-mx-5 flex gap-4 overflow-x-auto px-5 no-scrollbar snap-x">
            {open.map((t) => (
              <Link
                key={t.id}
                to="/tournaments/$id"
                params={{ id: t.id }}
                className="snap-center w-72 flex-none rounded-xl bg-surface p-4 ring-1 ring-border"
              >
                <div className="mb-6 flex items-start justify-between">
                  <div>
                    <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-accent">
                      {t.size} Player Cup
                    </span>
                    <span className="font-display text-2xl font-semibold tracking-tight">
                      {formatUsd(t.entry_cents)}
                    </span>
                  </div>
                  <span className="rounded bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Bo{t.best_of}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="size-6 rounded-full bg-secondary grid place-items-center">
                    <Trophy className="size-3 text-primary" />
                  </div>
                  <span className="text-xs font-medium truncate">{t.name}</span>
                </div>
                <div className="mt-4 border-t border-border/60 pt-4 text-center">
                  <span className="text-xs font-semibold text-primary">VIEW BRACKET</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {isOwner && (
        <section className="px-5 mb-6 animate-fade-in-up">
          <Link to="/tournaments" className="block w-full rounded-2xl bg-gradient-neon p-[1px] ring-purple">
            <div className="rounded-2xl bg-background/80 p-5 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Step up</p>
                <p className="font-display text-2xl font-semibold leading-tight">Create a Tournament</p>
                <p className="text-xs text-muted-foreground mt-1">Double-elimination • 4 or 8 players</p>
              </div>
              <div className="size-12 rounded-xl bg-gradient-neon grid place-items-center text-background ring-neon">
                <Plus className="size-6" strokeWidth={2.5} />
              </div>
            </div>
          </Link>
        </section>
      )}

      <section className="px-5 grid grid-cols-2 gap-3 mb-6">
        <QuickAction to="/tournaments" icon={Users} label="Tournaments" tint="primary" />
        <QuickAction to="/leaderboard" icon={Award} label="Leaderboard" tint="accent" />
        <QuickAction to="/wallet" icon={Trophy} label="Wallet" tint="muted" />
        <QuickAction to="/messages" icon={MessageSquare} label="Messages" tint="primary" />
      </section>

      <section className="px-5">
        <div className="rounded-xl bg-surface ring-1 ring-border p-5 flex items-center gap-4">
          <div className="size-10 rounded-lg bg-primary/15 grid place-items-center text-primary">
            <Flame className="size-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">
              {me?.display_name || me?.username || "Player"}
            </p>
            <p className="text-[11px] text-muted-foreground">Welcome back to the arena.</p>
          </div>
        </div>
      </section>
    </AppShell>
  );
}

function QuickAction({
  to, icon: Icon, label, tint,
}: { to: string; icon: React.ElementType; label: string; tint: "primary" | "accent" | "muted" }) {
  const tintClass = tint === "primary" ? "text-primary" : tint === "accent" ? "text-accent" : "text-muted-foreground";
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
