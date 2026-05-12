import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { leaderboard } from "@/lib/mock-data";
import { Trophy } from "lucide-react";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Leaderboard — SMYD" },
      { name: "description", content: "Top earning darts players on SMYD this season." },
    ],
  }),
  component: Leaderboard,
});

function Leaderboard() {
  const top = leaderboard.filter((p) => !p.isYou);
  const you = leaderboard.find((p) => p.isYou)!;

  return (
    <AppShell>
      <div className="px-5 py-6 space-y-5 animate-fade-in-up">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">Season 1</p>
          <h1 className="font-display text-3xl font-bold mt-1">Leaderboard</h1>
        </div>

        {/* Top 3 podium */}
        <div className="grid grid-cols-3 gap-2 items-end">
          <Podium player={top[1]} height="h-24" tint="bg-zinc-400/20 ring-zinc-400/40 text-zinc-300" />
          <Podium player={top[0]} height="h-32" tint="bg-gradient-neon ring-neon text-background" champion />
          <Podium player={top[2]} height="h-20" tint="bg-amber-700/20 ring-amber-700/40 text-amber-400" />
        </div>

        <div className="rounded-xl bg-surface ring-1 ring-border divide-y divide-border/60">
          {top.slice(3).map((p) => (
            <Row key={p.rank} p={p} />
          ))}
        </div>

        {/* Your rank pinned */}
        <div className="sticky bottom-24 rounded-xl bg-gradient-neon p-[1px] ring-purple">
          <div className="rounded-xl bg-background/90 px-4 py-3 flex items-center gap-3">
            <span className="font-display text-sm font-bold text-primary w-12">#{you.rank}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{you.name}</p>
              <p className="text-[11px] text-muted-foreground">{you.wins} wins • {you.winRate}%</p>
            </div>
            <span className="font-display text-sm font-bold text-success">${you.earnings}</span>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Podium({
  player, height, tint, champion = false,
}: { player: typeof leaderboard[number]; height: string; tint: string; champion?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2">
      {champion && <Trophy className="size-5 text-primary" />}
      <div className="size-12 rounded-full bg-surface ring-1 ring-border grid place-items-center font-display font-bold text-sm">
        {player.name[0]}
      </div>
      <p className="text-[10px] font-semibold truncate max-w-[80px] text-center">{player.name}</p>
      <p className="text-[10px] font-display font-bold text-success">${(player.earnings / 1000).toFixed(1)}k</p>
      <div className={`w-full ${height} rounded-t-lg ring-1 ${tint} grid place-items-center font-display text-xl font-bold`}>
        {player.rank}
      </div>
    </div>
  );
}

function Row({ p }: { p: typeof leaderboard[number] }) {
  return (
    <div className="px-4 py-3 flex items-center gap-3">
      <span className="font-display text-sm font-bold text-muted-foreground w-8">#{p.rank}</span>
      <div className="size-8 rounded-full bg-secondary grid place-items-center text-xs font-bold">
        {p.name[0]}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{p.name}</p>
        <p className="text-[10px] text-muted-foreground">{p.wins} W • {p.winRate}%</p>
      </div>
      <span className="font-display text-sm font-semibold text-success">${(p.earnings / 1000).toFixed(1)}k</span>
    </div>
  );
}
