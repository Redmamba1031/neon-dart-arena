import { useEffect, useState } from "react";
import { Clock, AlertTriangle, Check } from "lucide-react";
import { toast } from "sonner";
import {
  useReportMatchWinner,
  useFinalizeMatchReport,
  timeLeftLabel,
  type Match,
} from "@/lib/api";

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function CountdownPill({ deadline }: { deadline: string | null | undefined }) {
  useNow();
  if (!deadline) return null;
  const label = timeLeftLabel(deadline);
  const expired = label === "Time expired";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
        expired ? "bg-secondary text-muted-foreground" : "bg-accent/15 text-accent"
      }`}
    >
      <Clock className="size-3" /> {label}
    </span>
  );
}

export function MatchReportPanel({
  match,
  meId,
  nameOf,
}: {
  match: Match;
  meId: string | undefined;
  nameOf: (id: string | null) => string;
}) {
  const report = useReportMatchWinner();
  const finalize = useFinalizeMatchReport();
  useNow();

  const m = match as Match & {
    report_deadline: string | null;
    reported_winner_id: string | null;
    reported_by: string | null;
    disputed: boolean;
  };

  const isMine = meId === m.creator_id || meId === m.opponent_id;
  if (!isMine || m.status !== "live") return null;

  const expired = !!m.report_deadline && new Date(m.report_deadline).getTime() <= Date.now();
  const iReported = m.reported_by === meId;
  const theyReported = !!m.reported_by && !iReported;

  const send = async (winnerId: string) => {
    try {
      const result = await report.mutateAsync({ matchId: m.id, winnerId });
      if (result === "settled") toast.success("Result confirmed — coins paid out");
      else if (result === "disputed") toast.error("Results don't match — this match is now disputed");
      else toast.success("Result submitted — waiting for your opponent to confirm");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not submit result");
    }
  };

  const doFinalize = async () => {
    try {
      await finalize.mutateAsync(m.id);
      toast.success("Result finalised — coins paid out");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not finalise");
    }
  };

  if (m.disputed) {
    return (
      <div className="mt-3 rounded-lg bg-destructive/10 ring-1 ring-destructive/40 p-3 text-[11px] text-destructive flex items-start gap-2">
        <AlertTriangle className="size-4 shrink-0" />
        <span>Both players reported different winners. This match is under review — coins stay held until it's resolved.</span>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Post the winner
        </p>
        <CountdownPill deadline={m.report_deadline} />
      </div>

      {theyReported && (
        <p className="text-[11px] text-muted-foreground">
          {nameOf(m.reported_by)} reported <span className="text-foreground font-semibold">{nameOf(m.reported_winner_id)}</span> as the winner. Confirm to release the coins.
        </p>
      )}
      {iReported && (
        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
          <Check className="size-3 text-success" /> You reported {nameOf(m.reported_winner_id)} — waiting on your opponent.
        </p>
      )}
      {!m.reported_by && (
        <p className="text-[11px] text-muted-foreground">
          You have 45 minutes from the start of the match to post the winner. Both players must agree.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => send(m.creator_id)}
          disabled={report.isPending}
          className="rounded-lg bg-primary py-2 text-[11px] font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
        >
          {nameOf(m.creator_id)} won
        </button>
        <button
          onClick={() => m.opponent_id && send(m.opponent_id)}
          disabled={report.isPending || !m.opponent_id}
          className="rounded-lg bg-primary py-2 text-[11px] font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
        >
          {nameOf(m.opponent_id)} won
        </button>
      </div>

      <p className="text-[10px] text-destructive flex items-start gap-1.5">
        <AlertTriangle className="size-3 shrink-0 mt-[1px]" />
        <span>Posting a false winner will get your account permanently banned.</span>
      </p>

      <p className="text-[10px] text-destructive flex items-start gap-1.5">
        <AlertTriangle className="size-3 shrink-0 mt-[1px]" />
        <span>Camera must show the board from more than 8 feet away. Flagged and proven by your opponent = automatic loss.</span>
      </p>


      {iReported && expired && (
        <button
          onClick={doFinalize}
          disabled={finalize.isPending}
          className="w-full rounded-lg bg-secondary py-2 text-[11px] font-bold uppercase tracking-wider disabled:opacity-50"
        >
          Claim result — opponent never responded
        </button>
      )}
    </div>
  );
}
