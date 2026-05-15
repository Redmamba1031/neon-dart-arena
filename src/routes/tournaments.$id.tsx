import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ArrowLeft, Trophy } from "lucide-react";
import {
  useTournamentDetail,
  useReportTournamentMatch,
  useCancelTournament,
  useMyProfile,
  useProfilesByIds,
  formatUsd,
  type TournamentMatch,
} from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/tournaments/$id")({
  head: () => ({ meta: [{ title: "Tournament — SMYD" }] }),
  component: TournamentDetail,
});

function TournamentDetail() {
  const { id } = Route.useParams();
  const { data, isLoading } = useTournamentDetail(id);
  const { data: me } = useMyProfile();
  const report = useReportTournamentMatch();
  const cancel = useCancelTournament();

  const playerIds = [
    ...(data?.participants ?? []).map((p) => p.user_id),
  ];
  const { data: profileMap } = useProfilesByIds(playerIds);
  const nameOf = (uid?: string | null) => {
    if (!uid) return "TBD";
    const p = profileMap?.get(uid);
    return p?.display_name || p?.username || "Player";
  };

  if (isLoading || !data?.tournament) {
    return <AppShell><div className="p-6 text-sm text-muted-foreground">Loading…</div></AppShell>;
  }

  const t = data.tournament;
  const pool = Number(t.entry_cents) * t.size;
  const net = pool - Math.floor((pool * (t.rake_bps ?? 500)) / 10000);

  const handleReport = async (matchId: string, winnerId: string) => {
    try {
      await report.mutateAsync({ matchId, winnerId });
      toast.success("Result recorded");
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    }
  };

  const handleCancel = async () => {
    if (!confirm("Cancel tournament and refund all participants?")) return;
    try {
      await cancel.mutateAsync(t.id);
      toast.success("Tournament cancelled");
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    }
  };

  const winners = data.matches.filter((m) => m.side === "winners");
  const losers = data.matches.filter((m) => m.side === "losers");
  const finals = data.matches.filter((m) => m.side === "grand_final");

  return (
    <AppShell>
      <div className="px-5 py-6 space-y-5 animate-fade-in-up">
        <Link to="/tournaments" className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <ArrowLeft className="size-3" /> All tournaments
        </Link>

        <div className="rounded-2xl bg-gradient-neon p-[1px]">
          <div className="rounded-2xl bg-background/90 p-5">
            <div className="flex items-center gap-2 text-primary">
              <Trophy className="size-4" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em]">{t.status}</span>
            </div>
            <h1 className="font-display text-2xl font-bold mt-2">{t.name}</h1>
            <p className="text-xs text-muted-foreground mt-1">
              {t.mode} • Bo{t.best_of} • {t.size} players • Entry {formatUsd(t.entry_cents)}
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <Stat label="Pool" value={formatUsd(pool)} />
              <Stat label="Net" value={formatUsd(net)} tint="text-success" />
              <Stat label="1st prize" value={formatUsd(Math.floor((net * 50) / 100))} tint="text-primary" />
            </div>
            {t.status === "open" && t.creator_id === me?.id && (
              <button onClick={handleCancel} className="mt-4 w-full rounded-xl ring-1 ring-destructive/50 text-destructive py-2 text-xs font-bold uppercase tracking-wider">
                Cancel & Refund
              </button>
            )}
            {t.status === "completed" && (
              <div className="mt-4 space-y-1 text-xs">
                <p>🥇 {nameOf(t.winner_id)} — {formatUsd(Math.floor((net * 50) / 100))}</p>
                <p>🥈 {nameOf(t.runner_up_id)} — {formatUsd(Math.floor((net * 30) / 100))}</p>
                {t.third_id && <p>🥉 {nameOf(t.third_id)} — {formatUsd(Math.floor((net * 20) / 100))}</p>}
              </div>
            )}
          </div>
        </div>

        <Section title={`Players (${data.participants.length}/${t.size})`}>
          <div className="rounded-xl bg-surface ring-1 ring-border divide-y divide-border/60">
            {data.participants.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="font-display text-xs text-muted-foreground w-6">{p.seed ? `#${p.seed}` : "—"}</span>
                <span className="flex-1 truncate">{nameOf(p.user_id)}{p.user_id === me?.id && " (you)"}</span>
                {p.placement && <span className="text-[10px] font-bold text-primary">#{p.placement}</span>}
              </div>
            ))}
          </div>
        </Section>

        {t.status !== "open" && (
          <>
            <BracketSection title="Winners Bracket" matches={winners} me={me?.id} nameOf={nameOf} onReport={handleReport} pending={report.isPending} />
            {losers.length > 0 && <BracketSection title="Losers Bracket" matches={losers} me={me?.id} nameOf={nameOf} onReport={handleReport} pending={report.isPending} />}
            {finals.length > 0 && <BracketSection title="Grand Final" matches={finals} me={me?.id} nameOf={nameOf} onReport={handleReport} pending={report.isPending} />}
          </>
        )}
      </div>
    </AppShell>
  );
}

function BracketSection({
  title, matches, me, nameOf, onReport, pending,
}: {
  title: string;
  matches: TournamentMatch[];
  me?: string;
  nameOf: (id?: string | null) => string;
  onReport: (matchId: string, winnerId: string) => void;
  pending: boolean;
}) {
  const rounds = Array.from(new Set(matches.map((m) => m.round))).sort();
  return (
    <Section title={title}>
      <div className="space-y-3">
        {rounds.map((r) => (
          <div key={r}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Round {r}</p>
            <div className="space-y-2">
              {matches.filter((m) => m.round === r).map((m) => {
                const canReport = !m.completed_at && m.player1_id && m.player2_id && me && (m.player1_id === me || m.player2_id === me);
                return (
                  <div key={m.id} className="rounded-xl bg-surface ring-1 ring-border p-3">
                    <PlayerRow name={nameOf(m.player1_id)} winner={m.winner_id === m.player1_id && !!m.completed_at} loser={m.loser_id === m.player1_id && !!m.completed_at} />
                    <div className="text-[9px] text-center text-muted-foreground my-0.5">vs</div>
                    <PlayerRow name={nameOf(m.player2_id)} winner={m.winner_id === m.player2_id && !!m.completed_at} loser={m.loser_id === m.player2_id && !!m.completed_at} />
                    {canReport && (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          onClick={() => onReport(m.id, m.player1_id!)}
                          disabled={pending}
                          className="rounded-lg bg-primary py-2 text-[11px] font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
                        >
                          {nameOf(m.player1_id)} won
                        </button>
                        <button
                          onClick={() => onReport(m.id, m.player2_id!)}
                          disabled={pending}
                          className="rounded-lg bg-primary py-2 text-[11px] font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
                        >
                          {nameOf(m.player2_id)} won
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function PlayerRow({ name, winner, loser }: { name: string; winner: boolean; loser: boolean }) {
  return (
    <div className={`flex items-center justify-between px-2 py-1 rounded ${
      winner ? "bg-success/10 text-success" : loser ? "text-muted-foreground line-through" : ""
    }`}>
      <span className="text-sm truncate">{name}</span>
      {winner && <span className="text-[10px] font-bold">W</span>}
    </div>
  );
}

function Stat({ label, value, tint = "text-foreground" }: { label: string; value: string; tint?: string }) {
  return (
    <div className="rounded-lg bg-surface/60 p-2 ring-1 ring-border">
      <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display text-sm font-semibold ${tint}`}>{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}
