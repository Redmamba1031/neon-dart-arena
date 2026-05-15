import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Plus, Zap, Trophy, History, Flame, MessageSquare, Target } from "lucide-react";
import { formatUsd, useMyProfile, useOpenMatches, useProfilesByIds } from "@/lib/api";

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
  const { data: matches = [] } = useOpenMatches();
  const { data: profileMap } = useProfilesByIds(matches.map((m) => m.creator_id));
  const { data: me } = useMyProfile();

  return (
    <AppShell>
      <section className="px-5 py-6 animate-fade-in-up">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Open Lobbies</h2>
          {matches.length > 0 && (
            <span className="size-2 animate-pulse rounded-full bg-destructive shadow-[0_0_8px_rgb(239,68,68)]" />
          )}
        </div>
        {matches.length === 0 ? (
          <div className="rounded-xl bg-surface ring-1 ring-border p-6 text-center text-sm text-muted-foreground">
            No open matches. Create one below.
          </div>
        ) : (
          <div className="-mx-5 flex gap-4 overflow-x-auto px-5 no-scrollbar snap-x">
            {matches.map((m) => {
              const host = profileMap?.get(m.creator_id);
              return (
                <Link
                  key={m.id}
                  to="/join-match"
                  className="snap-center w-72 flex-none rounded-xl bg-surface p-4 ring-1 ring-border"
                >
                  <div className="mb-6 flex items-start justify-between">
                    <div>
                      <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-accent">
                        {m.mode}
                      </span>
                      <span className="font-display text-2xl font-semibold tracking-tight">
                        {formatUsd(m.stake_cents)}
                      </span>
                    </div>
                    <span className="rounded bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Bo{m.best_of}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="size-6 rounded-full bg-secondary grid place-items-center">
                      <Target className="size-3 text-primary" />
                    </div>
                    <span className="text-xs font-medium truncate">
                      {host?.display_name || host?.username || "Player"}
                    </span>
                  </div>
                  <div className="mt-4 border-t border-border/60 pt-4 text-center">
                    <span className="text-xs font-semibold text-primary">JOIN CHALLENGE</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className="px-5 mb-6 animate-fade-in-up">
        <Link to="/create-match" className="block w-full rounded-2xl bg-gradient-neon p-[1px] ring-purple">
          <div className="rounded-2xl bg-background/80 p-5 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Step up</p>
              <p className="font-display text-2xl font-semibold leading-tight">Create a Match</p>
              <p className="text-xs text-muted-foreground mt-1">501 • Set your stake</p>
            </div>
            <div className="size-12 rounded-xl bg-gradient-neon grid place-items-center text-background ring-neon">
              <Plus className="size-6" strokeWidth={2.5} />
            </div>
          </div>
        </Link>
      </section>

      <section className="px-5 grid grid-cols-2 gap-3 mb-6">
        <QuickAction to="/join-match" icon={Zap} label="Quick Join" tint="primary" />
        <QuickAction to="/leaderboard" icon={Trophy} label="Leaderboard" tint="accent" />
        <QuickAction to="/history" icon={History} label="History" tint="muted" />
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
