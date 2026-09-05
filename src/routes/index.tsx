import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Trophy, Flame, MessageSquare, Award, Swords } from "lucide-react";
import { useMyProfile } from "@/lib/api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lobby — SMYD" },
      { name: "description", content: "Your darts arena. Quick play and 1v1 matches." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data: me } = useMyProfile();

  return (
    <AppShell>
      <section className="px-5 pt-6 grid grid-cols-2 gap-3 mb-6 animate-fade-in-up">
        <QuickAction to="/matches" icon={Swords} label="1v1 Matches" tint="primary" />
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
