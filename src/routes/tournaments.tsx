import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Trophy, Plus, Users, Loader2 } from "lucide-react";
import {
  useTournaments,
  useCreateTournament,
  useJoinTournament,
  useMyProfile,
  formatUsd,
  toCents,
} from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/tournaments")({
  head: () => ({
    meta: [
      { title: "Tournaments — SMYD" },
      { name: "description", content: "Join double-elimination darts tournaments with top-3 payouts." },
    ],
  }),
  component: Tournaments,
});

function Tournaments() {
  const navigate = useNavigate();
  const { data: me } = useMyProfile();
  const { data: tournaments = [], isLoading } = useTournaments();
  const join = useJoinTournament();
  const [showCreate, setShowCreate] = useState(false);

  const handleJoin = async (id: string) => {
    try {
      await join.mutateAsync(id);
      toast.success("Joined tournament");
      navigate({ to: "/tournaments/$id", params: { id } });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to join");
    }
  };

  return (
    <AppShell>
      <div className="px-5 py-6 space-y-5 animate-fade-in-up">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">Compete</p>
            <h1 className="font-display text-3xl font-bold mt-1">Tournaments</h1>
          </div>
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="rounded-xl bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground flex items-center gap-2"
          >
            <Plus className="size-4" /> {showCreate ? "Close" : "New"}
          </button>
        </div>

        {showCreate && <CreateForm onCreated={(id) => { setShowCreate(false); navigate({ to: "/tournaments/$id", params: { id } }); }} />}

        {isLoading ? (
          <div className="rounded-xl bg-surface ring-1 ring-border p-6 text-center text-sm text-muted-foreground">Loading…</div>
        ) : tournaments.length === 0 ? (
          <div className="rounded-xl bg-surface ring-1 ring-border p-6 text-center text-sm text-muted-foreground">
            No active tournaments. Create one to get started.
          </div>
        ) : (
          <div className="space-y-3">
            {tournaments.map((t) => (
              <Link
                key={t.id}
                to="/tournaments/$id"
                params={{ id: t.id }}
                className="block rounded-xl bg-surface ring-1 ring-border p-4 hover:ring-primary/40 transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="size-10 rounded-lg bg-primary/15 grid place-items-center text-primary">
                    <Trophy className="size-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{t.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {t.mode} • Bo{t.best_of} • {t.size} players • Entry {formatUsd(t.entry_cents)}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                        t.status === "open" ? "bg-success/15 text-success" : "bg-primary/15 text-primary"
                      }`}>
                        {t.status}
                      </span>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Users className="size-3" /> Pool {formatUsd(Number(t.entry_cents) * t.size)}
                      </span>
                    </div>
                  </div>
                  {t.status === "open" && t.creator_id !== me?.id && (
                    <button
                      onClick={(e) => { e.preventDefault(); handleJoin(t.id); }}
                      disabled={join.isPending}
                      className="rounded-lg bg-primary px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
                    >
                      Join
                    </button>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function CreateForm({ onCreated }: { onCreated: (id: string) => void }) {
  const create = useCreateTournament();
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"501" | "Cricket" | "Medley">("501");
  const [bestOf, setBestOf] = useState<1 | 3 | 5>(3);
  const [size, setSize] = useState<4 | 8>(4);
  const [entry, setEntry] = useState(10);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const id = await create.mutateAsync({
        name: name.trim(),
        mode,
        best_of: bestOf,
        size,
        entry_cents: toCents(entry),
      });
      toast.success("Tournament created");
      onCreated(id);
    } catch (err: any) {
      toast.error(err.message ?? "Create failed");
    }
  };

  return (
    <form onSubmit={submit} className="rounded-xl bg-surface ring-1 ring-border p-4 space-y-3">
      <Field label="Name">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={3}
          maxLength={60}
          className="w-full rounded-lg bg-background ring-1 ring-border px-3 py-2 text-sm"
          placeholder="Friday Night Cup"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Mode">
          <select value={mode} onChange={(e) => setMode(e.target.value as any)} className="w-full rounded-lg bg-background ring-1 ring-border px-3 py-2 text-sm">
            <option>501</option><option>Cricket</option><option>Medley</option>
          </select>
        </Field>
        <Field label="Best of">
          <select value={bestOf} onChange={(e) => setBestOf(Number(e.target.value) as any)} className="w-full rounded-lg bg-background ring-1 ring-border px-3 py-2 text-sm">
            <option value={1}>1</option><option value={3}>3</option><option value={5}>5</option>
          </select>
        </Field>
        <Field label="Size">
          <select value={size} onChange={(e) => setSize(Number(e.target.value) as any)} className="w-full rounded-lg bg-background ring-1 ring-border px-3 py-2 text-sm">
            <option value={4}>4 players</option><option value={8}>8 players</option>
          </select>
        </Field>
        <Field label="Entry ($)">
          <input type="number" min={1} max={1000000} value={entry} onChange={(e) => setEntry(Number(e.target.value))} className="w-full rounded-lg bg-background ring-1 ring-border px-3 py-2 text-sm" />
        </Field>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Pool: {formatUsd(toCents(entry) * size)} • Payout 50/30/20 of pool minus 5% rake
      </p>
      <button type="submit" disabled={create.isPending} className="w-full rounded-xl bg-primary py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground flex items-center justify-center gap-2 disabled:opacity-60">
        {create.isPending && <Loader2 className="size-4 animate-spin" />}
        Create & Pay Entry
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
