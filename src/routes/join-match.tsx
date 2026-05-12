import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { MatchCard } from "@/components/MatchCard";
import { liveMatches } from "@/lib/mock-data";
import { useState } from "react";

export const Route = createFileRoute("/join-match")({
  head: () => ({
    meta: [
      { title: "Join Match — SMYD" },
      { name: "description", content: "Find an open darts match and jump in." },
    ],
  }),
  component: JoinMatch,
});

function JoinMatch() {
  const [filter, setFilter] = useState<"all" | "501" | "Cricket">("all");
  const filtered = liveMatches.filter((m) => filter === "all" || m.mode === filter);

  return (
    <AppShell>
      <div className="px-5 py-6 space-y-5 animate-fade-in-up">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">Open Lobbies</p>
          <h1 className="font-display text-3xl font-bold mt-1">Join Match</h1>
        </div>

        <div className="flex gap-2">
          {(["all", "501", "Cricket"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all ${
                filter === f
                  ? "bg-gradient-neon text-background ring-neon"
                  : "bg-surface ring-1 ring-border text-muted-foreground"
              }`}
            >
              {f === "all" ? "All" : f}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {filtered.map((m) => (
            <div key={m.id} className="rounded-2xl bg-surface ring-1 ring-border p-4 flex items-center gap-4 hover:ring-primary/40 transition-all">
              <div className="text-center">
                <p className="text-[9px] font-bold uppercase tracking-tighter text-muted-foreground">Entry</p>
                <p className="font-display text-xl font-bold text-success">${m.stake}</p>
              </div>
              <div className="h-10 w-px bg-border" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{m.modeLabel}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {m.hostName} • Bo{m.bestOf}
                </p>
              </div>
              <button className="rounded-lg bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground ring-neon">
                Join
              </button>
            </div>
          ))}
        </div>

        <div className="pt-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Featured</p>
          <div className="-mx-5 flex gap-4 overflow-x-auto px-5 no-scrollbar">
            {liveMatches.slice(0, 3).map((m) => (
              <MatchCard key={m.id} match={m} />
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
