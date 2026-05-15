import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useMatchHistory, useMyProfile, useProfilesByIds, formatUsd } from "@/lib/api";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Match History — SMYD" },
      { name: "description", content: "Review your past darts matches and earnings." },
    ],
  }),
  component: History,
});

function History() {
  const { data: me } = useMyProfile();
  const { data: matches = [], isLoading } = useMatchHistory(50);

  const opponentIds = matches.map((m) => (m.creator_id === me?.id ? m.opponent_id : m.creator_id)).filter(Boolean) as string[];
  const { data: profileMap } = useProfilesByIds(opponentIds);

  const wins = matches.filter((m) => m.winner_id === me?.id).length;
  const total = matches.length;
  const netCents = matches.reduce((s, m) => {
    const stake = Number(m.stake_cents);
    if (m.winner_id === me?.id) {
      const pot = stake * 2;
      const rake = Math.floor((pot * (m.rake_bps ?? 500)) / 10000);
      return s + (pot - rake - stake);
    }
    return s - stake;
  }, 0);

  return (
    <AppShell>
      <div className="px-5 py-6 space-y-5 animate-fade-in-up">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Records</p>
          <h1 className="font-display text-3xl font-bold mt-1">Match History</h1>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Stat label="Played" value={String(total)} />
          <Stat label="Won" value={`${wins}/${total}`} tint="text-primary" />
          <Stat
            label="Net"
            value={`${netCents >= 0 ? "+" : "−"}${formatUsd(Math.abs(netCents))}`}
            tint={netCents >= 0 ? "text-success" : "text-destructive"}
          />
        </div>

        {isLoading ? (
          <div className="rounded-xl bg-surface ring-1 ring-border p-6 text-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : matches.length === 0 ? (
          <div className="rounded-xl bg-surface ring-1 ring-border p-6 text-center text-sm text-muted-foreground">
            No completed matches yet. Win one to see it here.
          </div>
        ) : (
          <div className="space-y-2">
            {matches.map((m) => {
              const won = m.winner_id === me?.id;
              const oppId = m.creator_id === me?.id ? m.opponent_id : m.creator_id;
              const opp = oppId ? profileMap?.get(oppId) : null;
              const oppName = opp?.display_name || opp?.username || "Opponent";
              const stake = Number(m.stake_cents);
              const pot = stake * 2;
              const rake = Math.floor((pot * (m.rake_bps ?? 500)) / 10000);
              const payout = won ? pot - rake - stake : -stake;
              const date = m.completed_at ? new Date(m.completed_at).toLocaleDateString() : "";
              return (
                <div key={m.id} className="rounded-xl bg-surface ring-1 ring-border p-4 flex items-center gap-4">
                  <div
                    className={`size-10 rounded-lg grid place-items-center font-display font-bold text-sm ${
                      won ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
                    }`}
                  >
                    {won ? "W" : "L"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">vs {oppName}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {m.mode} • Bo{m.best_of} • Stake {formatUsd(stake)} • {date}
                    </p>
                  </div>
                  <span className={`font-display text-sm font-bold ${payout >= 0 ? "text-success" : "text-destructive"}`}>
                    {payout >= 0 ? "+" : "−"}
                    {formatUsd(Math.abs(payout))}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Stat({ label, value, tint = "text-foreground" }: { label: string; value: string; tint?: string }) {
  return (
    <div className="rounded-xl bg-surface p-3 ring-1 ring-border">
      <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display text-base font-semibold ${tint}`}>{value}</p>
    </div>
  );
}
