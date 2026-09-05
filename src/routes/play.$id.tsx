import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Loader2, Undo2, Trophy } from "lucide-react";
import {
  useMatch,
  useMatchLegs,
  useStartLeg,
  useRecordDart,
  useCompleteLeg,
  useMyProfile,
  useProfilesByIds,
  formatCoins,
} from "@/lib/api";
import {
  newOhOne,
  newCricket,
  throwOhOne,
  throwCricket,
  dartLabel,
  isClosed,
  CRICKET_NUMBERS,
  type Dart,
  type Multiplier,
  type OhOneState,
  type CricketState,
  type Side,
  type FinishRule,
} from "@/lib/darts";

export const Route = createFileRoute("/play/$id")({
  head: () => ({
    meta: [
      { title: "Live Scoring — SMYD" },
      { name: "description", content: "Score your live SMYD darts match dart by dart." },
      { property: "og:title", content: "Live Scoring — SMYD" },
      { property: "og:description", content: "Dart-by-dart scoring for 501 and Cricket matches." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Play,
});

type AnyState = OhOneState | CricketState;

function Play() {
  const { id } = useParams({ from: "/play/$id" });
  const { data: match, isLoading } = useMatch(id);
  const { data: legs = [] } = useMatchLegs(id);
  const { data: me } = useMyProfile();
  const startLeg = useStartLeg();
  const recordDart = useRecordDart();
  const completeLeg = useCompleteLeg();

  const ids = match ? ([match.creator_id, match.opponent_id].filter(Boolean) as string[]) : [];
  const { data: profiles } = useProfilesByIds(ids);
  const nameOf = (pid: string | null) => {
    if (!pid) return "Opponent";
    const p = profiles?.get(pid);
    return p?.display_name || p?.username || "Player";
  };

  const legMode: "501" | "Cricket" = match?.mode === "Cricket" ? "Cricket" : "501";
  const openLeg = legs.find((l) => !l.completed_at) ?? null;

  const [state, setState] = useState<AnyState | null>(null);
  const [multiplier, setMultiplier] = useState<Multiplier>(1);

  // Load or create the active leg, hydrating saved state.
  useEffect(() => {
    if (!match || match.status !== "live") return;
    if (!openLeg) {
      startLeg.mutate({ matchId: match.id, legMode });
      return;
    }
    const saved = openLeg.state as unknown as AnyState | null;
    if (saved && typeof saved === "object" && "kind" in saved) {
      setState(saved);
    } else {
      setState(legMode === "Cricket" ? newCricket() : newOhOne(match.double_in));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.id, match?.status, openLeg?.id]);

  const mySide: Side | null = useMemo(() => {
    if (!match || !me) return null;
    if (match.creator_id === me.id) return "a";
    if (match.opponent_id === me.id) return "b";
    return null;
  }, [match, me]);

  if (isLoading) {
    return (
      <AppShell>
        <div className="px-5 py-16 text-center text-sm text-muted-foreground">
          <Loader2 className="mx-auto mb-3 size-5 animate-spin" /> Loading match…
        </div>
      </AppShell>
    );
  }

  if (!match) {
    return (
      <AppShell>
        <div className="px-5 py-16 text-center space-y-3">
          <p className="text-sm text-muted-foreground">That match no longer exists.</p>
          <Link to="/matches" className="text-xs font-bold uppercase tracking-wider text-primary">
            Back to matches
          </Link>
        </div>
      </AppShell>
    );
  }

  if (match.status === "completed") {
    return (
      <AppShell>
        <div className="px-5 py-16 text-center space-y-4 animate-fade-in-up">
          <Trophy className="mx-auto size-10 text-primary" />
          <h1 className="font-display text-2xl font-bold">{nameOf(match.winner_id)} wins</h1>
          <p className="text-sm text-muted-foreground">
            {match.creator_legs} – {match.opponent_legs} • Pot {formatCoins(match.stake_cents * 2)}
          </p>
          <Link to="/matches" className="inline-block rounded-xl bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-primary-foreground">
            Back to matches
          </Link>
        </div>
      </AppShell>
    );
  }

  if (match.status !== "live") {
    return (
      <AppShell>
        <div className="px-5 py-16 text-center space-y-3">
          <p className="text-sm text-muted-foreground">This match hasn't started yet — waiting for an opponent.</p>
          <Link to="/matches" className="text-xs font-bold uppercase tracking-wider text-primary">Back to matches</Link>
        </div>
      </AppShell>
    );
  }

  if (!mySide) {
    return (
      <AppShell>
        <div className="px-5 py-16 text-center text-sm text-muted-foreground">You're not a player in this match.</div>
      </AppShell>
    );
  }

  if (!state || !openLeg) {
    return (
      <AppShell>
        <div className="px-5 py-16 text-center text-sm text-muted-foreground">
          <Loader2 className="mx-auto mb-3 size-5 animate-spin" /> Setting up the board…
        </div>
      </AppShell>
    );
  }

  const activeSide = state.turn;
  const isMyTurn = activeSide === mySide;
  const winnerIdFor = (side: Side) => (side === "a" ? match.creator_id : (match.opponent_id as string));

  const throwDart = async (segment: number, mult: Multiplier) => {
    if (!isMyTurn) {
      toast.error("It's your opponent's turn");
      return;
    }
    const dart: Dart = { segment, multiplier: segment === 0 ? 0 : mult };
    const dartNumber = state.darts.length + 1;
    const turnNumber = state.turnNumber;

    const result =
      state.kind === "Cricket"
        ? throwCricket(state as CricketState, dart)
        : throwOhOne(state as OhOneState, dart, {
            doubleIn: match.double_in,
            finishRule: (match.finish_rule ?? "double") as FinishRule,
          });

    setState(result.state);
    setMultiplier(1);

    try {
      await recordDart.mutateAsync({
        legId: openLeg.id,
        turnNumber,
        dartNumber,
        segment,
        multiplier: dart.multiplier,
        busted: result.busted,
        remainingAfter: result.remainingAfter,
        state: result.state,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save that dart");
    }

    if (result.busted) toast.info("Bust — turn over");

    if (result.won) {
      try {
        await completeLeg.mutateAsync({ legId: openLeg.id, winnerId: winnerIdFor(activeSide) });
        toast.success(`Leg won by ${nameOf(winnerIdFor(activeSide))}`);
        setState(null);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not finish the leg");
      }
    }
  };

  const creatorName = nameOf(match.creator_id);
  const opponentName = nameOf(match.opponent_id);

  return (
    <AppShell>
      <div className="px-5 py-6 space-y-5 animate-fade-in-up">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
            Leg {openLeg.leg_number} • {legMode} • Bo{match.best_of}
          </p>
          <h1 className="font-display text-2xl font-bold mt-1">
            {creatorName} <span className="text-muted-foreground">vs</span> {opponentName}
          </h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Legs {match.creator_legs}–{match.opponent_legs} • Pot {formatCoins(match.stake_cents * 2)}
          </p>
        </div>

        {state.kind === "501" ? (
          <div className="grid grid-cols-2 gap-3">
            <ScorePanel name={creatorName} value={String((state as OhOneState).remaining.a)} active={activeSide === "a"} />
            <ScorePanel name={opponentName} value={String((state as OhOneState).remaining.b)} active={activeSide === "b"} />
          </div>
        ) : (
          <CricketBoard state={state as CricketState} aName={creatorName} bName={opponentName} activeSide={activeSide} />
        )}

        <div className="rounded-xl bg-surface ring-1 ring-border p-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              {isMyTurn ? "Your throw" : `${nameOf(winnerIdFor(activeSide))} is throwing`}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Dart {Math.min(state.darts.length + 1, 3)} of 3
            </p>
          </div>
          <div className="mt-2 flex gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex-1 rounded-lg bg-background ring-1 ring-border py-2 text-center text-xs font-semibold">
                {state.darts[i] ? dartLabel(state.darts[i]) : "–"}
              </div>
            ))}
          </div>
          {state.lastEvent && <p className="mt-2 text-[11px] text-muted-foreground">{state.lastEvent}</p>}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {([1, 2, 3] as Multiplier[]).map((m) => (
            <button
              key={m}
              onClick={() => setMultiplier(m)}
              className={`rounded-lg py-2.5 text-[11px] font-bold uppercase tracking-wider ring-1 ${
                multiplier === m ? "bg-primary text-primary-foreground ring-primary" : "bg-surface text-muted-foreground ring-border"
              }`}
            >
              {m === 1 ? "Single" : m === 2 ? "Double" : "Triple"}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-5 gap-2">
          {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              disabled={!isMyTurn || recordDart.isPending}
              onClick={() => throwDart(n, multiplier)}
              className="rounded-lg bg-surface ring-1 ring-border py-3 text-sm font-semibold disabled:opacity-40 active:scale-[0.97] transition-transform"
            >
              {n}
            </button>
          ))}
          <button
            disabled={!isMyTurn}
            onClick={() => throwDart(25, 1)}
            className="rounded-lg bg-accent/20 ring-1 ring-accent/40 py-3 text-xs font-bold uppercase text-accent disabled:opacity-40"
          >
            Bull
          </button>
          <button
            disabled={!isMyTurn}
            onClick={() => throwDart(25, 2)}
            className="rounded-lg bg-primary/20 ring-1 ring-primary/40 py-3 text-xs font-bold uppercase text-primary disabled:opacity-40"
          >
            D-Bull
          </button>
          <button
            disabled={!isMyTurn}
            onClick={() => throwDart(0, 0)}
            className="col-span-3 rounded-lg bg-secondary ring-1 ring-border py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <Undo2 className="size-4" /> Miss
          </button>
        </div>
      </div>
    </AppShell>
  );
}

function ScorePanel({ name, value, active }: { name: string; value: string; active: boolean }) {
  return (
    <div className={`rounded-xl p-4 ring-1 ${active ? "bg-primary/10 ring-primary" : "bg-surface ring-border"}`}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground truncate">{name}</p>
      <p className={`mt-1 font-display text-4xl font-bold ${active ? "text-primary" : ""}`}>{value}</p>
    </div>
  );
}

function CricketBoard({
  state,
  aName,
  bName,
  activeSide,
}: {
  state: CricketState;
  aName: string;
  bName: string;
  activeSide: Side;
}) {
  const marks = (side: Side, n: number) => {
    const m = state.marks[side][n] ?? 0;
    return m >= 3 ? "✓" : m === 2 ? "✗" : m === 1 ? "/" : "";
  };
  return (
    <div className="rounded-xl bg-surface ring-1 ring-border overflow-hidden">
      <div className="grid grid-cols-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        <div className={`p-2 text-center truncate ${activeSide === "a" ? "text-primary" : ""}`}>{aName}</div>
        <div className="p-2 text-center">#</div>
        <div className={`p-2 text-center truncate ${activeSide === "b" ? "text-primary" : ""}`}>{bName}</div>
      </div>
      {CRICKET_NUMBERS.map((n) => (
        <div key={n} className="grid grid-cols-3 border-t border-border text-sm">
          <div className={`p-2 text-center font-semibold ${isClosed(state, "a", n) ? "text-success" : ""}`}>{marks("a", n)}</div>
          <div className="p-2 text-center text-xs text-muted-foreground">{n === 25 ? "Bull" : n}</div>
          <div className={`p-2 text-center font-semibold ${isClosed(state, "b", n) ? "text-success" : ""}`}>{marks("b", n)}</div>
        </div>
      ))}
      <div className="grid grid-cols-3 border-t border-border bg-background">
        <div className="p-2 text-center font-display text-lg font-bold">{state.score.a}</div>
        <div className="p-2 text-center text-[10px] uppercase tracking-widest text-muted-foreground self-center">Points</div>
        <div className="p-2 text-center font-display text-lg font-bold">{state.score.b}</div>
      </div>
    </div>
  );
}
