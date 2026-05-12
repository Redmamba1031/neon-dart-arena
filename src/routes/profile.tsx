import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { MessageSquare, Settings, LogOut, Award, Target } from "lucide-react";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — SMYD" },
      { name: "description", content: "Your SMYD player profile, stats, and Discord link." },
    ],
  }),
  component: Profile,
});

function Profile() {
  return (
    <AppShell>
      <div className="px-5 py-6 space-y-6 animate-fade-in-up">
        {/* Hero */}
        <div className="relative rounded-2xl bg-gradient-neon p-[1px]">
          <div className="rounded-2xl bg-background/90 p-6 relative overflow-hidden">
            <div className="absolute inset-0 scanline opacity-10 pointer-events-none" />
            <div className="flex items-center gap-4 relative">
              <div className="size-20 rounded-2xl bg-surface ring-2 ring-primary/60 grid place-items-center font-display text-2xl font-bold text-primary">
                VX
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Rank #1,402</p>
                <h2 className="font-display text-2xl font-bold mt-1 truncate">Viper_X</h2>
                <p className="text-xs text-muted-foreground">Member since 2025</p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3 relative">
              <Stat label="Wins" value="86" />
              <Stat label="Win %" value="68%" tint="text-primary" />
              <Stat label="Streak" value="8🔥" tint="text-accent" />
            </div>
          </div>
        </div>

        {/* Discord */}
        <div className="rounded-xl bg-surface ring-1 ring-border p-4 flex items-center gap-3">
          <div className="size-10 rounded-lg bg-discord/15 grid place-items-center text-discord">
            <MessageSquare className="size-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Discord</p>
            <p className="text-[11px] text-muted-foreground">Linked as Viper_X#0420</p>
          </div>
          <a
            href="https://discord.gg/lovable-dev"
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-discord px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white"
          >
            Open
          </a>
        </div>

        {/* Game prefs */}
        <Section title="Favorite Modes">
          <div className="grid grid-cols-2 gap-3">
            <Pref icon={Target} label="501 Master Out" sub="42 wins" />
            <Pref icon={Award} label="Cricket Pro" sub="28 wins" />
          </div>
        </Section>

        {/* Achievements */}
        <Section title="Achievements">
          <div className="grid grid-cols-4 gap-2">
            {["First Blood", "10-Win Streak", "$1k Club", "180 Hit"].map((a) => (
              <div key={a} className="aspect-square rounded-lg bg-surface ring-1 ring-border grid place-items-center text-center p-2">
                <span className="text-[10px] font-bold uppercase tracking-tight text-primary">{a}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* Actions */}
        <div className="space-y-2">
          <Action icon={Settings} label="Settings" />
          <Link to="/login">
            <Action icon={LogOut} label="Sign Out" danger />
          </Link>
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

function Action({ icon: Icon, label, danger = false }: { icon: React.ElementType; label: string; danger?: boolean }) {
  return (
    <div className={`flex items-center gap-3 rounded-xl bg-surface ring-1 ring-border px-4 py-3 cursor-pointer hover:ring-primary/40 transition-all ${
      danger ? "text-destructive" : ""
    }`}>
      <Icon className="size-4" />
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}
