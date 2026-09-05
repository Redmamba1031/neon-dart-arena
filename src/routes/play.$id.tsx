import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ArrowLeft, Swords, Trophy } from "lucide-react";
import { MatchReportPanel } from "@/components/MatchReportPanel";
import { useMatch, useMyProfile, useProfilesByIds, formatCoins } from "@/lib/api";

export const Route = createFileRoute("/play/$id")({
  head: () => ({
    meta: [
      { title: "Post Match Winner — SMYD" },
      { name: "description", content: "Post the winner of your SMYD darts match within the 45 minute reporting window." },
      { property: "og:title", content: "Post Match Winner — SMYD" },
      { property: "og:description", content: "Report and confirm your darts match result on SMYD." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlayMatch,
});

function PlayMatch() {
  const { id } = Route.useParams();
  const { data: match, isLoading } = useMatch(id);
  const { data: me } = useMyProfile();
  const ids = [match?.creator_id, match?.opponent_id].filter(Boolean) as string[];
  const { data: profiles } = useProfilesByIds(ids);
  const nameOf = (pid: string | null) => {
    if (!pid) return "Waiting…";
    const p = profiles?.get(pid);
    return p?.display_name || p?.username || "Player";
  };

  if (isLoading) {
    return <AppShell><div className="p-6 text-sm text-muted-foreground">Loading…</div></AppShell>;
  }
  if (!match) {
    return (
      <AppShell>
        <div className="p-6 space-y-3">
          <p className="text-sm text-muted-foreground">Match not found.</p>
          <Link to="/matches" className="text-xs font-bold uppercase tracking-wider text-primary">Back to matches</Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="px-5 py-6 space-y-5 animate-fade-in-up">
        <Link to="/matches" className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <ArrowLeft className="size-3" /> All matches
        </Link>

        <div className="rounded-2xl bg-surface ring-1 ring-border p-5">
          <div className="flex items-center gap-2 text-primary">
            {match.status === "completed" ? <Trophy className="size-4" /> : <Swords className="size-4" />}
            <span className="text-[10px] font-bold uppercase tracking-[0.2em]">{match.status}</span>
          </div>
          <h1 className="font-display text-2xl font-bold mt-2">
            {nameOf(match.creator_id)} <span className="text-muted-foreground text-base">vs</span> {nameOf(match.opponent_id)}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {match.mode} • Bo{match.best_of} • Stake {formatCoins(match.stake_cents)} • Pot {formatCoins(Number(match.stake_cents) * 2)}
          </p>

          {match.status === "completed" && match.winner_id && (
            <p className="mt-4 text-sm font-semibold text-success">Winner: {nameOf(match.winner_id)}</p>
          )}

          <MatchReportPanel match={match} meId={me?.id} nameOf={nameOf} />
        </div>

        <div className="rounded-xl bg-surface/60 ring-1 ring-border p-4 text-[11px] text-muted-foreground leading-relaxed">
          Play your match on your board, then post the winner here. You get <span className="text-foreground font-semibold">45 minutes</span> from
          the start of the match. Coins are released as soon as both players post the same winner. If you disagree, the match is flagged
          for review. If your opponent never posts, you can claim the result once the 45 minutes are up.
          <span className="block mt-2 text-destructive font-semibold">
            Camera rule: your camera must show the full board from more than 8 feet away for the whole match. If your opponent
            flags you and proves it, you take an automatic loss.
          </span>
          <span className="block mt-2 text-destructive font-semibold">
            Fair play rule: reporting a false winner results in a permanent ban from SMYD.
          </span>

        </div>
      </div>
    </AppShell>
  );
}
