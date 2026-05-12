import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { matchHistory } from "@/lib/mock-data";

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
  const wins = matchHistory.filter((m) => m.result === "W").length;
  const total = matchHistory.length;
  const net = matchHistory.reduce((s, m) => s + m.payout, 0);

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
          <Stat label="Net" value={`${net >= 0 ? "+" : ""}$${net}`} tint={net >= 0 ? "text-success" : "text-destructive"} />
        </div>

        <div className="space-y-2">
          {matchHistory.map((m) => (
            <div key={m.id} className="rounded-xl bg-surface ring-1 ring-border p-4 flex items-center gap-4">
              <div className={`size-10 rounded-lg grid place-items-center font-display font-bold text-sm ${
                m.result === "W" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
              }`}>
                {m.result}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">vs {m.opponent}</p>
                <p className="text-[11px] text-muted-foreground">
                  {m.mode} • Stake ${m.stake} • {m.date}
                </p>
              </div>
              <span className={`font-display text-sm font-bold ${
                m.payout >= 0 ? "text-success" : "text-destructive"
              }`}>
                {m.payout >= 0 ? "+" : ""}${m.payout}
              </span>
            </div>
          ))}
        </div>
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
