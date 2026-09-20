import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Coins, Swords, History, ArrowDownLeft, Trophy } from "lucide-react";
import {
  formatMoney,
  useWallet,
  useMyMatches,
  useMatchHistory,
  useMyProfile,
  useTransactions,
  useProfilesByIds,
  type Match,
} from "@/lib/api";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "My Dashboard — SMYD" },
      {
        name: "description",
        content:
          "Your SMYD dashboard: account balance, active darts matches, deposits and match history.",
      },
      { property: "og:title", content: "My Dashboard — SMYD" },
      {
        property: "og:description",
        content: "Balance, active matches, deposits and match history in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardPage,
});

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function DashboardPage() {
  const { data: profile } = useMyProfile();
  const { data: wallet, isLoading: walletLoading } = useWallet();
  const { data: active = [] } = useMyMatches();
  const { data: history = [] } = useMatchHistory(25);
  const { data: txns = [] } = useTransactions(100);

  const deposits = txns.filter((t) => t.kind === "deposit");
  const depositTotal = deposits.reduce((s, t) => s + Number(t.amount_cents), 0);

  const myId = profile?.id;
  const wins = history.filter((m) => m.winner_id === myId).length;
  const losses = history.length - wins;

  const opponentIds = [...active, ...history].flatMap((m) =>
    [m.creator_id, m.opponent_id].filter((id): id is string => !!id && id !== myId),
  );
  const { data: opponents = [] } = useProfilesByIds(opponentIds);
  const nameFor = (id: string | null) => {
    if (!id) return "Waiting for opponent";
    const p = opponents.find((o) => o.id === id);
    return p?.display_name || p?.username || "Player";
  };
  const otherId = (m: Match) => (m.creator_id === myId ? m.opponent_id : m.creator_id);

  return (
    <AppShell>
      <div className="px-5 py-6 space-y-6 animate-fade-in-up">
        <div className="relative rounded-2xl bg-gradient-neon p-[1px]">
          <div className="relative overflow-hidden rounded-2xl bg-background/85 p-6">
            <div className="scanline pointer-events-none absolute inset-0 opacity-10" />
            <div className="flex items-center gap-2 text-primary">
              <Coins className="size-4" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em]">
                Account Balance
              </span>
            </div>
            <p className="mt-3 font-display text-4xl font-bold text-gradient-neon">
              {walletLoading ? "—" : formatMoney(wallet?.balance_cents)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {profile?.display_name || profile?.username || "Player"} · {wins}W – {losses}L
            </p>
            <div className="mt-4 flex gap-2">
              <Link
                to="/shop"
                className="flex-1 rounded-lg bg-primary py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-primary-foreground"
              >
                Cashier
              </Link>
              <Link
                to="/matches"
                className="flex-1 rounded-lg bg-surface py-2.5 text-center text-[11px] font-bold uppercase tracking-wider ring-1 ring-border"
              >
                Find a match
              </Link>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Mini label="Active" value={String(active.length)} tint="text-primary" />
          <Mini label="Played" value={String(history.length)} tint="text-accent" />
          <Mini label="Deposited" value={formatMoney(depositTotal)} tint="text-success" />
        </div>

        <Section icon={Swords} title="Active matches">
          {active.length === 0 ? (
            <Empty text="No active matches. Create or join one from the 1v1 page." />
          ) : (
            <List>
              {active.map((m) => (
                <Link
                  key={m.id}
                  to="/play/$id"
                  params={{ id: m.id }}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-background/40"
                >
                  <div className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Swords className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {m.mode} · Best of {m.best_of}
                    </p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      vs {nameFor(otherId(m))} · {m.status}
                    </p>
                  </div>
                  <span className="font-display text-sm font-semibold">
                    {formatMoney(Number(m.stake_cents))}
                  </span>
                </Link>
              ))}
            </List>
          )}
        </Section>

        <Section icon={History} title="Match history">
          {history.length === 0 ? (
            <Empty text="No completed matches yet." />
          ) : (
            <List>
              {history.map((m) => {
                const won = m.winner_id === myId;
                return (
                  <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                    <div
                      className={`grid size-9 place-items-center rounded-lg ${
                        won ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      <Trophy className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {won ? "Won" : "Lost"} vs {nameFor(otherId(m))}
                      </p>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {m.mode} · {fmtDate(m.completed_at)}
                      </p>
                    </div>
                    <span
                      className={`font-display text-sm font-semibold ${
                        won ? "text-success" : "text-muted-foreground"
                      }`}
                    >
                      {formatMoney(Number(m.stake_cents))}
                    </span>
                  </div>
                );
              })}
            </List>
          )}
        </Section>

        <Section icon={ArrowDownLeft} title="Deposits">
          {deposits.length === 0 ? (
            <Empty text="No deposits yet. Add funds from the Cashier." />
          ) : (
            <List>
              {deposits.map((t) => (
                <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="grid size-9 place-items-center rounded-lg bg-success/10 text-success">
                    <ArrowDownLeft className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{t.note ?? "Funds added"}</p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {fmtDate(t.created_at)}
                    </p>
                  </div>
                  <span className="font-display text-sm font-semibold text-success">
                    +{formatMoney(Math.abs(Number(t.amount_cents)))}
                  </span>
                </div>
              ))}
            </List>
          )}
        </Section>
      </div>
    </AppShell>
  );
}

function Mini({ label, value, tint = "text-foreground" }: { label: string; value: string; tint?: string }) {
  return (
    <div className="rounded-xl bg-surface p-3 ring-1 ring-border">
      <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display text-base font-semibold ${tint}`}>{value}</p>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <Icon className="size-3.5" />
        {title}
      </h3>
      {children}
    </section>
  );
}

function List({ children }: { children: React.ReactNode }) {
  return (
    <div className="divide-y divide-border/60 rounded-xl bg-surface ring-1 ring-border">
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-xl bg-surface p-6 text-center text-sm text-muted-foreground ring-1 ring-border">
      {text}
    </div>
  );
}
