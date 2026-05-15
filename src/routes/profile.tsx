import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { MessageSquare, Settings, LogOut, Target, ChevronRight } from "lucide-react";
import { useMyProfile, useLeaderboard, formatUsd } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — SMYD" },
      { name: "description", content: "Your SMYD player profile and stats." },
    ],
  }),
  component: Profile,
});

function Profile() {
  const navigate = useNavigate();
  const { data: profile } = useMyProfile();
  const { data: leaderboard = [] } = useLeaderboard(500);

  const me = leaderboard.find((l) => l.user_id === profile?.id);
  const wins = me?.wins ?? 0;
  const total = me?.games_played ?? 0;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
  const rank = profile ? leaderboard.findIndex((l) => l.user_id === profile.id) + 1 : 0;

  const name = profile?.display_name || profile?.username || "Player";
  const initials = name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/login" });
  };

  return (
    <AppShell>
      <div className="px-5 py-6 space-y-6 animate-fade-in-up">
        <div className="relative rounded-2xl bg-gradient-neon p-[1px]">
          <div className="rounded-2xl bg-background/90 p-6 relative overflow-hidden">
            <div className="absolute inset-0 scanline opacity-10 pointer-events-none" />
            <div className="flex items-center gap-4 relative">
              <div className="size-20 rounded-2xl bg-surface ring-2 ring-primary/60 grid place-items-center font-display text-2xl font-bold text-primary overflow-hidden">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt={name} className="size-full object-cover" />
                ) : (
                  initials || "P"
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                  {rank > 0 ? `Rank #${rank}` : "Unranked"}
                </p>
                <h2 className="font-display text-2xl font-bold mt-1 truncate">{name}</h2>
                <p className="text-xs text-muted-foreground">
                  {profile?.username ? `@${profile.username}` : "Member"}
                </p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3 relative">
              <Stat label="Wins" value={String(wins)} />
              <Stat label="Win %" value={`${winRate}%`} tint="text-primary" />
              <Stat label="Played" value={String(total)} tint="text-accent" />
            </div>
          </div>
        </div>

        <Link
          to="/messages"
          className="block rounded-xl bg-surface ring-1 ring-border p-4 hover:ring-primary/40 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-primary/15 grid place-items-center text-primary">
              <MessageSquare className="size-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Messages</p>
              <p className="text-[11px] text-muted-foreground">Chat with players</p>
            </div>
            <ChevronRight className="size-4 text-muted-foreground" />
          </div>
        </Link>

        <Section title="Favorite Mode">
          <Pref icon={Target} label="501" sub={`${mode501Wins} wins`} />
        </Section>

        <div className="space-y-2">
          <Action icon={Settings} label="Settings" onClick={() => toast.info("Settings coming soon")} />
          <Action icon={LogOut} label="Sign Out" danger onClick={handleSignOut} />
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value, tint = "text-foreground" }: { label: string; value: string; tint?: string }) {
  return (
    <div className="rounded-lg bg-surface/80 p-2.5 text-center ring-1 ring-border">
      <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display text-base font-semibold ${tint}`}>{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function Pref({ icon: Icon, label, sub }: { icon: React.ElementType; label: string; sub: string }) {
  return (
    <div className="rounded-xl bg-surface ring-1 ring-border p-3 flex items-center gap-3">
      <div className="size-8 rounded-lg bg-background grid place-items-center text-primary">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold truncate">{label}</p>
        <p className="text-[10px] text-muted-foreground">{sub}</p>
      </div>
    </div>
  );
}

function Action({
  icon: Icon,
  label,
  danger = false,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  danger?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 rounded-xl bg-surface ring-1 ring-border px-4 py-3 cursor-pointer hover:ring-primary/40 transition-all text-left ${
        danger ? "text-destructive" : ""
      }`}
    >
      <Icon className="size-4" />
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}
