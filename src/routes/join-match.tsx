import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { formatUsd, useJoinMatch, useOpenMatches, useProfilesByIds, useWallet } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

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
  const [filter, setFilter] = useState<"all" | "501" | "Cricket" | "Medley">("all");
  const [me, setMe] = useState<string | null>(null);
  const { data: matches = [] } = useOpenMatches();
  const { data: wallet } = useWallet();
  const { data: profileMap } = useProfilesByIds(matches.map((m) => m.creator_id));
  const join = useJoinMatch();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null));
  }, []);

  const filtered = matches.filter((m) => filter === "all" || m.mode === filter);

  const handleJoin = async (id: string, stake: number) => {
    if ((wallet?.balance_cents ?? 0) < stake) {
      toast.error("Not enough balance — top up your wallet.");
      return;
    }
    try {
      await join.mutateAsync(id);
      toast.success("You're in. Good luck!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't join match");
    }
  };

  return (
    <AppShell>
      <div className="px-5 py-6 space-y-5 animate-fade-in-up">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">Open Lobbies</p>
          <h1 className="font-display text-3xl font-bold mt-1">Join Match</h1>
        </div>

        <div className="flex gap-2 flex-wrap">
          {(["all", "501", "Cricket", "Medley"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all ${
                filter === f ? "bg-gradient-neon text-background ring-neon" : "bg-surface ring-1 ring-border text-muted-foreground"
              }`}
            >
              {f === "all" ? "All" : f}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-xl bg-surface ring-1 ring-border p-6 text-center text-sm text-muted-foreground">
            No open matches in this category.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((m) => {
              const host = profileMap?.get(m.creator_id);
              const isMine = me === m.creator_id;
              return (
                <div key={m.id} className="rounded-2xl bg-surface ring-1 ring-border p-4 flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-[9px] font-bold uppercase tracking-tighter text-muted-foreground">Entry</p>
                    <p className="font-display text-xl font-bold text-success">{formatUsd(m.stake_cents)}</p>
                  </div>
                  <div className="h-10 w-px bg-border" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">
                      {m.mode}
                      {m.mode !== "Cricket" && ` • ${labelForFinish(m.finish_rule)}`}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {host?.display_name || host?.username || "Player"} • Bo{m.best_of}
                    </p>
                  </div>
                  <button
                    onClick={() => handleJoin(m.id, m.stake_cents)}
                    disabled={isMine || join.isPending}
                    className="rounded-lg bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground ring-neon disabled:opacity-50"
                  >
                    {isMine ? "Yours" : "Join"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function labelForFinish(f: string) {
  switch (f) {
    case "straight": return "Straight Out";
    case "double": return "Double Out";
    case "master": return "Master Out";
    case "both": return "Double In/Out";
    default: return f;
  }
}
