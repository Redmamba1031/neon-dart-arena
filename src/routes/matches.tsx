import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Swords, Plus, Loader2, Trophy, X, Search } from "lucide-react";
import {
  useOpenMatches,
  useMyMatches,
  useMatchHistory,
  useCreateMatch,
  useJoinMatch,
  useCancelMatch,
  useMyProfile,
  useWallet,
  useProfilesByIds,
  useMyChallenges,
  useRespondChallenge,
  usePlayerSearch,
  formatCoins,
  toCents,
  type Match,
} from "@/lib/api";
import { toast } from "sonner";
import { MatchReportPanel } from "@/components/MatchReportPanel";

export const Route = createFileRoute("/matches")({
  head: () => ({
    meta: [
      { title: "1v1 Matches — SMYD" },
      { name: "description", content: "Create or join head-to-head darts matches and stake coins on 501, Cricket, Medley or Piddle." },
      { property: "og:title", content: "1v1 Matches — SMYD" },
      { property: "og:description", content: "Head-to-head darts matches with coin stakes on SMYD." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Matches,
});

type Tab = "open" | "mine" | "history";

function Matches() {
  const [tab, setTab] = useState<Tab>("open");
  const [showCreate, setShowCreate] = useState(false);

  const { data: me } = useMyProfile();
  const { data: open = [], isLoading: loadingOpen } = useOpenMatches();
  const { data: mine = [], isLoading: loadingMine } = useMyMatches();
  const { data: history = [], isLoading: loadingHistory } = useMatchHistory();

  const list = tab === "open" ? open.filter((m) => m.creator_id !== me?.id) : tab === "mine" ? mine : history;
  const loading = tab === "open" ? loadingOpen : tab === "mine" ? loadingMine : loadingHistory;

  const ids = list.flatMap((m) => [m.creator_id, m.opponent_id].filter(Boolean) as string[]);
  const { data: profiles } = useProfilesByIds(ids);

  return (
    <AppShell>
      <div className="px-5 py-6 space-y-5 animate-fade-in-up">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">Head to head</p>
            <h1 className="font-display text-3xl font-bold mt-1">1v1 Matches</h1>
          </div>
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="rounded-xl bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground flex items-center gap-2"
          >
            {showCreate ? <X className="size-4" /> : <Plus className="size-4" />}
            {showCreate ? "Close" : "New"}
          </button>
        </div>

        <ChallengeInbox meId={me?.id} />

        {showCreate && <CreateMatchForm onCreated={() => { setShowCreate(false); setTab("mine"); }} />}

        <div className="grid grid-cols-3 gap-2 rounded-xl bg-surface p-1 ring-1 ring-border">
          {(["open", "mine", "history"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg py-2 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {t === "open" ? "Open" : t === "mine" ? "My Matches" : "History"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="rounded-xl bg-surface ring-1 ring-border p-6 text-center text-sm text-muted-foreground">Loading…</div>
        ) : list.length === 0 ? (
          <div className="rounded-xl bg-surface ring-1 ring-border p-6 text-center text-sm text-muted-foreground">
            {tab === "open" ? "No open matches. Create one to challenge the arena." : tab === "mine" ? "You have no active matches." : "No completed matches yet."}
          </div>
        ) : (
          <div className="space-y-3">
            {list.map((m) => (
              <MatchRow key={m.id} match={m} meId={me?.id} nameOf={(id) => nameFrom(profiles, id)} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function nameFrom(
  profiles: Map<string, { username: string | null; display_name: string | null }> | undefined,
  id: string | null,
) {
  if (!id) return "Waiting…";
  const p = profiles?.get(id);
  return p?.display_name || p?.username || "Player";
}

function MatchRow({
  match: m,
  meId,
  nameOf,
}: {
  match: Match;
  meId: string | undefined;
  nameOf: (id: string | null) => string;
}) {
  const join = useJoinMatch();
  const cancel = useCancelMatch();

  const isMine = m.creator_id === meId || m.opponent_id === meId;
  const rules = [m.double_in ? "Double In" : "Straight In", finishLabel(m.finish_rule)].join(" • ");

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
    } catch (e: any) {
      toast.error(e?.message ?? "Action failed");
    }
  };

  return (
    <div className="rounded-xl bg-surface ring-1 ring-border p-4">
      <div className="flex items-start gap-3">
        <div className="size-10 rounded-lg bg-primary/15 grid place-items-center text-primary">
          {m.status === "completed" ? <Trophy className="size-5" /> : <Swords className="size-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">
            {nameOf(m.creator_id)} <span className="text-muted-foreground">vs</span> {nameOf(m.opponent_id)}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {m.mode} • Bo{m.best_of} • Stake {formatCoins(m.stake_cents)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{rules}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                m.status === "open"
                  ? "bg-success/15 text-success"
                  : m.status === "live"
                    ? "bg-primary/15 text-primary"
                    : "bg-secondary text-muted-foreground"
              }`}
            >
              {m.status}
            </span>
            {m.status === "completed" && m.winner_id && (
              <span className="text-[10px] text-muted-foreground">Winner: {nameOf(m.winner_id)}</span>
            )}
          </div>
        </div>
      </div>

      {m.status === "open" && (
        <div className="mt-3 flex gap-2">
          {!isMine && (
            <button
              onClick={() => act(() => join.mutateAsync(m.id), "Joined match")}
              disabled={join.isPending}
              className="flex-1 rounded-lg bg-primary py-2 text-[11px] font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
            >
              Join • {formatCoins(m.stake_cents)}
            </button>
          )}
          {m.creator_id === meId && (
            <button
              onClick={() => act(() => cancel.mutateAsync(m.id), "Match cancelled")}
              disabled={cancel.isPending}
              className="flex-1 rounded-lg bg-secondary py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground disabled:opacity-50"
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {m.status === "live" && isMine && <MatchReportPanel match={m} meId={meId} nameOf={nameOf} />}

    </div>
  );
}

function finishLabel(rule: Match["finish_rule"]) {
  return rule === "straight" ? "Straight Out" : rule === "double" ? "Double Out" : rule === "master" ? "Master Out" : "Double or Master Out";
}

const MODES = ["501", "Cricket", "Medley", "Piddle"] as const;

function CreateMatchForm({ onCreated }: { onCreated: () => void }) {
  const create = useCreateMatch();
  const { data: wallet } = useWallet();
  const [mode, setMode] = useState<(typeof MODES)[number]>("501");
  const [bestOf, setBestOf] = useState<1 | 3 | 5>(1);
  const [stake, setStake] = useState(500);
  const [doubleIn, setDoubleIn] = useState(false);
  const [finish, setFinish] = useState<"straight" | "double" | "master" | "both">("double");
  const [opponent, setOpponent] = useState<{ id: string; name: string } | null>(null);

  const isMedley = mode === "Medley";
  const bestOfOptions: (1 | 3 | 5)[] = isMedley ? [3, 5] : [1, 3, 5];
  const showOhOneRules = mode === "501" || isMedley;
  const balance = wallet?.balance_cents ?? 0;
  const walletReady = wallet !== undefined;
  const notEnough = walletReady && toCents(stake) > balance;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (notEnough) {
      toast.error("Not enough coins for this stake — grab a coin pack in the Shop.");
      return;
    }
    try {
      await create.mutateAsync({
        mode,
        best_of: isMedley && bestOf === 1 ? 3 : bestOf,
        stake_cents: toCents(stake),
        double_in: showOhOneRules ? doubleIn : false,
        finish_rule: showOhOneRules ? finish : "double",
        opponent_id: opponent?.id ?? null,
      });
      toast.success(opponent ? `Challenge sent to ${opponent.name}` : "Match created — waiting for an opponent");
      onCreated();
    } catch (err: any) {
      toast.error(err?.message ?? "Create failed");
    }
  };


  return (
    <form onSubmit={submit} className="rounded-xl bg-surface ring-1 ring-border p-4 space-y-3">
      <Field label="Challenge a player">
        <OpponentPicker value={opponent} onChange={setOpponent} />
      </Field>

      <Field label="Game mode">
        <div className="grid grid-cols-4 gap-2">
          {MODES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); if (m === "Medley" && bestOf === 1) setBestOf(3); }}
              className={`rounded-lg py-2 text-[11px] font-bold uppercase tracking-wider ring-1 ${
                mode === m ? "bg-primary text-primary-foreground ring-primary" : "bg-background text-muted-foreground ring-border"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </Field>

      {isMedley && (
        <div className="rounded-lg bg-background ring-1 ring-border px-3 py-2 text-[11px] text-muted-foreground">
          <span className="font-bold uppercase tracking-widest text-foreground">Medley</span> ·{" "}
          {bestOf === 5 ? "501 → Cricket → Cricket → 501 → Choice" : "501 → Cricket → Choice"} (choice picked by the piddle winner)
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Best of">
          <div className="flex gap-2">
            {bestOfOptions.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setBestOf(n)}
                className={`flex-1 rounded-lg py-2 text-[11px] font-bold ring-1 ${
                  bestOf === n ? "bg-primary text-primary-foreground ring-primary" : "bg-background text-muted-foreground ring-border"
                }`}
              >
                Bo{n}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Stake (coins)">
          <input
            type="number"
            min={500}
            max={1000000}
            value={stake}
            onChange={(e) => setStake(Number(e.target.value))}
            className="w-full rounded-lg bg-background ring-1 ring-border px-3 py-2 text-sm"
          />
        </Field>
      </div>

      {showOhOneRules && (
        <>
          <Field label="01 finish rule">
            <div className="grid grid-cols-4 gap-2">
              {(["straight", "double", "master", "both"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setFinish(r)}
                  className={`rounded-lg py-2 text-[10px] font-bold uppercase tracking-wider ring-1 ${
                    finish === r ? "bg-primary text-primary-foreground ring-primary" : "bg-background text-muted-foreground ring-border"
                  }`}
                >
                  {r === "straight" ? "Straight" : r === "double" ? "Double" : r === "master" ? "Master" : "Both"}
                </button>
              ))}
            </div>
          </Field>
          <label className="flex items-center justify-between rounded-lg bg-background ring-1 ring-border px-3 py-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Double In</span>
            <input type="checkbox" checked={doubleIn} onChange={(e) => setDoubleIn(e.target.checked)} className="size-4 accent-current" />
          </label>
        </>
      )}

      <p className="text-[11px] text-muted-foreground">
        Pot {formatCoins(toCents(stake) * 2)} • Winner takes the pot minus 10% house fee
      </p>
      <p className={`text-[11px] ${notEnough ? "text-primary font-bold" : "text-muted-foreground"}`}>
        Your balance: {walletReady ? formatCoins(balance) : "…"}
        {notEnough && " — not enough coins for this stake. Get more in the Shop."}
      </p>
      <button
        type="submit"
        disabled={create.isPending || notEnough}
        className="w-full rounded-xl bg-primary py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {create.isPending && <Loader2 className="size-4 animate-spin" />}
        Create & Stake {formatCoins(toCents(stake))}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function ChallengeInbox({ meId }: { meId: string | undefined }) {
  const { data: challenges = [] } = useMyChallenges();
  const respond = useRespondChallenge();
  const ids = challenges.flatMap((c) => [c.challenger_id, c.challenged_id]);
  const { data: profiles } = useProfilesByIds(ids);

  const incoming = challenges.filter((c) => c.challenged_id === meId);
  const outgoing = challenges.filter((c) => c.challenger_id === meId);
  if (incoming.length === 0 && outgoing.length === 0) return null;

  const act = async (challengeId: string, accept: boolean) => {
    try {
      await respond.mutateAsync({ challengeId, accept });
      toast.success(accept ? "Challenge accepted — good luck" : "Challenge declined");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not respond");
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">Challenges</p>
      {incoming.map((c) => (
        <div key={c.id} className="rounded-xl bg-surface ring-1 ring-primary/40 p-3">
          <p className="text-sm font-semibold">
            {nameFrom(profiles, c.challenger_id)} challenged you
          </p>
          <p className="text-[11px] text-muted-foreground">Stake {formatCoins(c.matches?.stake_cents ?? 0)}</p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => act(c.id, true)}
              disabled={respond.isPending}
              className="flex-1 rounded-lg bg-primary py-2 text-[11px] font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
            >
              Accept
            </button>
            <button
              onClick={() => act(c.id, false)}
              disabled={respond.isPending}
              className="flex-1 rounded-lg bg-secondary py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground disabled:opacity-50"
            >
              Decline
            </button>
          </div>
        </div>
      ))}
      {outgoing.map((c) => (
        <div key={c.id} className="rounded-xl bg-surface ring-1 ring-border p-3">
          <p className="text-sm font-semibold">Waiting on {nameFrom(profiles, c.challenged_id)}</p>
          <p className="text-[11px] text-muted-foreground">Stake {formatCoins(c.matches?.stake_cents ?? 0)} • pending</p>
        </div>
      ))}
    </div>
  );
}

function OpponentPicker({
  value,
  onChange,
}: {
  value: { id: string; name: string } | null;
  onChange: (v: { id: string; name: string } | null) => void;
}) {
  const [term, setTerm] = useState("");
  const { data: results = [], isFetching } = usePlayerSearch(term);

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-lg bg-background ring-1 ring-border px-3 py-2">
        <span className="text-sm font-semibold">{value.name}</span>
        <button type="button" onClick={() => onChange(null)} className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 rounded-lg bg-background ring-1 ring-border px-3 py-2">
        <Search className="size-4 text-muted-foreground" />
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search a player (optional)"
          className="w-full bg-transparent text-sm focus:outline-none"
        />
      </div>
      {isFetching && <p className="text-[11px] text-muted-foreground">Searching…</p>}
      {results.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onChange({ id: p.id, name: p.display_name || p.username || "Player" })}
          className="w-full rounded-lg bg-background ring-1 ring-border px-3 py-2 text-left text-sm hover:ring-primary/50"
        >
          {p.display_name || p.username}
        </button>
      ))}
      {term.trim().length >= 2 && !isFetching && results.length === 0 && (
        <p className="text-[11px] text-muted-foreground">No players found — leave empty for an open match.</p>
      )}
    </div>
  );
}
