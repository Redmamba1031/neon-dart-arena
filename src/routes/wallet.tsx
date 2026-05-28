import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ArrowDownLeft, ArrowUpRight, Coins } from "lucide-react";
import { useWallet, useTransactions, formatCoins, type WalletTxn } from "@/lib/api";

export const Route = createFileRoute("/wallet")({
  head: () => ({
    meta: [
      { title: "Coins — SMYD" },
      { name: "description", content: "Track your SMYD coins, earned from matches and tournaments." },
    ],
  }),
  component: Wallet,
});

const KIND_LABEL: Record<WalletTxn["kind"], string> = {
  deposit: "Bonus",
  withdrawal: "Adjustment",
  match_stake: "Match stake",
  match_payout: "Match payout",
  rake: "Platform fee",
  refund: "Refund",
};

function timeAgo(iso: string) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}

function Wallet() {
  const { data: wallet, isLoading } = useWallet();
  const { data: txns = [] } = useTransactions(25);

  const weekNet = txns
    .filter((t) => Date.now() - new Date(t.created_at).getTime() < 7 * 86400000)
    .reduce((s, t) => s + Number(t.amount_cents), 0);
  const lifetimePayouts = txns
    .filter((t) => t.kind === "match_payout")
    .reduce((s, t) => s + Number(t.amount_cents), 0);

  return (
    <AppShell>
      <div className="px-5 py-6 space-y-6 animate-fade-in-up">
        <div className="relative rounded-2xl bg-gradient-neon p-[1px] ring-purple">
          <div className="rounded-2xl bg-background/85 p-6 relative overflow-hidden">
            <div className="scanline absolute inset-0 opacity-10 pointer-events-none" />
            <div className="flex items-center gap-2 text-primary">
              <Coins className="size-4" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Coin Balance</span>
            </div>
            <p className="mt-3 font-display text-5xl font-bold text-gradient-neon">
              {isLoading ? "—" : formatCoins(wallet?.balance_cents)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Earn more by winning matches and tournaments.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Mini label="Lifetime Won" value={formatCoins(lifetimePayouts)} tint="text-success" />
          <Mini
            label="This Week"
            value={`${weekNet >= 0 ? "+" : "−"}${formatCoins(Math.abs(weekNet))}`}
            tint={weekNet >= 0 ? "text-success" : "text-destructive"}
          />
          <Mini label="Pending" value="0 coins" />
        </div>

        <div>
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Recent Activity
          </h3>
          {txns.length === 0 ? (
            <div className="rounded-xl bg-surface ring-1 ring-border p-6 text-center text-sm text-muted-foreground">
              No transactions yet.
            </div>
          ) : (
            <div className="rounded-xl bg-surface ring-1 ring-border divide-y divide-border/60">
              {txns.map((t) => {
                const positive = Number(t.amount_cents) > 0;
                return (
                  <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                    <div
                      className={`size-9 rounded-lg grid place-items-center ${
                        positive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {positive ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{t.note ?? KIND_LABEL[t.kind]}</p>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {KIND_LABEL[t.kind]} • {timeAgo(t.created_at)}
                      </p>
                    </div>
                    <span className={`font-display text-sm font-semibold ${positive ? "text-success" : "text-foreground"}`}>
                      {positive ? "+" : "−"}
                      {formatCoins(Math.abs(Number(t.amount_cents)))}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
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
