import { Link } from "@tanstack/react-router";
import { Target } from "lucide-react";

export type Match = {
  id: string;
  mode: "501" | "Cricket";
  modeLabel: string;
  stake: number;
  bestOf: number;
  hostName: string;
  opponentName?: string;
  status: "open" | "live" | "completed";
  rules?: string;
};

export function MatchCard({ match }: { match: Match }) {
  const accent = match.mode === "501" ? "text-accent" : "text-primary";
  return (
    <div className="relative w-72 flex-none overflow-hidden rounded-xl bg-surface p-4 ring-1 ring-border animate-fade-in-up">
      <div className="scanline absolute inset-0 opacity-20 pointer-events-none" />
      <div className="relative">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <span className={`mb-1 block text-[10px] font-medium uppercase tracking-wider ${accent}`}>
              {match.modeLabel}
            </span>
            <span className="font-display text-2xl font-semibold tracking-tight">
              ${match.stake.toFixed(2)}
            </span>
          </div>
          <span className="rounded bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {match.status === "live" ? "Live" : `Best of ${match.bestOf}`}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <PlayerChip name={match.hostName} />
          <span className="text-xs font-medium text-muted-foreground">VS</span>
          {match.opponentName ? (
            <PlayerChip name={match.opponentName} />
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Waiting…</span>
              <div className="size-6 rounded-full border border-dashed border-border" />
            </div>
          )}
        </div>

        <div className="mt-4 border-t border-border/60 pt-4 text-center">
          {match.status === "open" ? (
            <Link
              to="/join-match"
              className="text-xs font-semibold text-primary transition-colors hover:text-foreground"
            >
              JOIN CHALLENGE
            </Link>
          ) : (
            <span className="text-xs font-semibold text-muted-foreground">SPECTATE</span>
          )}
        </div>
      </div>
    </div>
  );
}

function PlayerChip({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="size-6 rounded-full bg-secondary grid place-items-center">
        <Target className="size-3 text-primary" />
      </div>
      <span className="text-xs font-medium text-foreground">{name}</span>
    </div>
  );
}
