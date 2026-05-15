import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Target } from "lucide-react";
import { formatUsd, toCents, useCreateMatch, useWallet } from "@/lib/api";

export const Route = createFileRoute("/create-match")({
  head: () => ({
    meta: [
      { title: "Create Match — SMYD" },
      { name: "description", content: "Set up a 501 darts match with custom stakes and rules." },
    ],
  }),
  component: CreateMatch,
});

type Mode = "501";
type FinishRule = "straight" | "double" | "master" | "both";

function CreateMatch() {
  const [mode, setMode] = useState<Mode>("501");
  const [doubleIn, setDoubleIn] = useState(false);
  const [finishRule, setFinishRule] = useState<FinishRule>("double");
  const [stake, setStake] = useState(25);
  const [bestOf, setBestOf] = useState<1 | 3 | 5>(3);
  const navigate = useNavigate();
  const { data: wallet } = useWallet();
  const createMatch = useCreateMatch();

  const insufficient = (wallet?.balance_cents ?? 0) < toCents(stake);

  const handleCreate = async () => {
    if (createMatch.isPending) return;
    if (insufficient) {
      toast.error("Not enough balance — top up your wallet.");
      navigate({ to: "/wallet" });
      return;
    }
    try {
      await createMatch.mutateAsync({
        mode,
        best_of: bestOf,
        stake_cents: toCents(stake),
        double_in: doubleIn,
        finish_rule: finishRule,
      });
      toast.success("Match created — waiting for an opponent.");
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create match");
    }
  };

  return (
    <AppShell>
      <div className="px-5 py-6 space-y-6 animate-fade-in-up">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">New Lobby</p>
          <h1 className="font-display text-3xl font-bold mt-1">Create Match</h1>
        </div>

        {/* 501 rules */}
        <Panel title="501 Rules">
          <div className="flex items-center gap-3">
            <Target className="size-5 text-primary" />
            <div>
              <p className="font-display text-lg font-bold leading-none">501</p>
              <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">Countdown</p>
            </div>
          </div>
          <Toggle label="Double In" desc="Must start with a double" checked={doubleIn} onChange={setDoubleIn} />
          <div className="pt-2">
            <p className="text-xs font-medium mb-2">Finish</p>
            <div className="grid grid-cols-2 gap-2">
              <FinishOpt active={finishRule === "straight"} onClick={() => setFinishRule("straight")} label="Straight Out" />
              <FinishOpt active={finishRule === "double"} onClick={() => setFinishRule("double")} label="Double Out" />
              <FinishOpt active={finishRule === "master"} onClick={() => setFinishRule("master")} label="Master Out" />
              <FinishOpt active={finishRule === "both"} onClick={() => setFinishRule("both")} label="Both" />
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">
              {finishRule === "straight" && "Finish on any segment — no double required."}
              {finishRule === "double" && "Finish on a double only."}
              {finishRule === "master" && "Finish on any double or triple."}
              {finishRule === "both" && "Open with a double and finish on a double."}
            </p>
          </div>
        </Panel>

        {/* Stake */}
        <Panel title="Stake">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-4xl font-bold text-gradient-neon">${stake}</span>
            <span className="text-xs text-muted-foreground">entry per player</span>
          </div>
          <div className="mt-3 grid grid-cols-5 gap-2">
            {[5, 10, 25, 50, 100].map((v) => (
              <button
                key={v}
                onClick={() => setStake(v)}
                className={`rounded-lg py-2 text-xs font-bold transition-all ${
                  stake === v
                    ? "bg-primary text-primary-foreground ring-neon"
                    : "bg-background ring-1 ring-border text-muted-foreground hover:text-foreground"
                }`}
              >
                ${v}
              </button>
            ))}
          </div>
          <p className="mt-3 text-[10px] uppercase tracking-wider text-muted-foreground">
            Winner takes <span className="text-success font-bold">${(stake * 1.9).toFixed(2)}</span>
            <span className="ml-1">(5% rake)</span>
          </p>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Balance: <span className="text-foreground">{formatUsd(wallet?.balance_cents)}</span>
            {insufficient && <span className="text-destructive ml-2">Insufficient funds</span>}
          </p>
        </Panel>

        {/* Best of */}
        <Panel title="Best Of">
          <div className="grid gap-2 grid-cols-3">
            {([1, 3, 5] as const).map((v) => (
              <button
                key={v}
                onClick={() => setBestOf(v)}
                className={`rounded-lg py-3 text-sm font-bold transition-all ${
                  bestOf === v
                    ? "bg-accent/20 ring-1 ring-accent text-accent"
                    : "bg-background ring-1 ring-border text-muted-foreground"
                }`}
              >
                Bo{v}
              </button>
            ))}
          </div>
        </Panel>

        <button
          onClick={handleCreate}
          disabled={createMatch.isPending}
          className="w-full rounded-xl bg-gradient-neon py-4 font-display text-sm font-semibold uppercase tracking-[0.15em] text-background transition-transform active:scale-[0.98] ring-neon disabled:opacity-60"
        >
          {createMatch.isPending ? "Creating…" : `Create Match • $${stake}`}
        </button>
      </div>
    </AppShell>
  );
}

function ModeButton({
  active, onClick, icon: Icon, label, sub,
}: { active: boolean; onClick: () => void; icon: React.ElementType; label: string; sub: string }) {
  return (
    <button
      onClick={onClick}
      className={`relative rounded-xl p-4 text-left transition-all ${
        active ? "bg-gradient-neon text-background ring-neon" : "bg-surface ring-1 ring-border text-foreground hover:ring-primary/40"
      }`}
    >
      <Icon className="size-5 mb-2" />
      <p className="font-display text-lg font-bold leading-none">{label}</p>
      <p className={`mt-1 text-[10px] uppercase tracking-wider ${active ? "text-background/70" : "text-muted-foreground"}`}>
        {sub}
      </p>
    </button>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-surface ring-1 ring-border p-5 space-y-4">
      <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function Toggle({
  label, desc, checked, onChange,
}: { label: string; desc: string; checked: boolean; onChange: (b: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)} className="flex items-center justify-between w-full">
      <div className="text-left">
        <p className="text-xs font-medium">{label}</p>
        <p className="text-[10px] text-muted-foreground">{desc}</p>
      </div>
      <div className={`relative w-11 h-6 rounded-full transition-colors ${
        checked ? "bg-primary/30 ring-1 ring-primary/60" : "bg-background ring-1 ring-border"
      }`}>
        <div className={`absolute top-1 size-4 rounded-full transition-all ${
          checked ? "left-6 bg-primary shadow-[0_0_8px_var(--neon)]" : "left-1 bg-muted-foreground"
        }`} />
      </div>
    </button>
  );
}

function FinishOpt({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg py-2.5 text-[10px] font-bold uppercase tracking-wider transition-all ${
        active ? "bg-accent text-accent-foreground ring-purple" : "bg-background ring-1 ring-border text-muted-foreground"
      }`}
    >
      {label}
    </button>
  );
}
