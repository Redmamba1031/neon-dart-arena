import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ArrowDownLeft, ArrowUpRight, Plus, Wallet as WalletIcon, X } from "lucide-react";
import { useWallet, useTransactions, formatUsd, toCents, type WalletTxn } from "@/lib/api";
import { toast } from "sonner";
import { StripeDepositCheckout } from "@/components/StripeEmbeddedCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";

export const Route = createFileRoute("/wallet")({
  head: () => ({
    meta: [
      { title: "Wallet — SMYD" },
      { name: "description", content: "Manage your SMYD wallet, deposits, and payouts." },
    ],
  }),
  component: Wallet,
});

const KIND_LABEL: Record<WalletTxn["kind"], string> = {
  deposit: "Deposit",
  withdrawal: "Withdrawal",
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
  const [depositOpen, setDepositOpen] = useState(false);
  const [amount, setAmount] = useState("25");
  const [checkoutAmount, setCheckoutAmount] = useState<number | null>(null);

  const weekNet = txns
    .filter((t) => Date.now() - new Date(t.created_at).getTime() < 7 * 86400000)
    .reduce((s, t) => s + Number(t.amount_cents), 0);
  const lifetimePayouts = txns
    .filter((t) => t.kind === "match_payout")
    .reduce((s, t) => s + Number(t.amount_cents), 0);

  const startCheckout = () => {
    const dollars = Number(amount);
    if (!Number.isFinite(dollars) || dollars < 5) {
      toast.error("Minimum deposit is $5");
      return;
    }
    if (dollars > 100000) {
      toast.error("Maximum deposit is $100,000");
      return;
    }
    setCheckoutAmount(toCents(dollars));
  };

  const closeAll = () => {
    setCheckoutAmount(null);
    setDepositOpen(false);
  };

  return (
    <AppShell>
      <PaymentTestModeBanner />
      <div className="px-5 py-6 space-y-6 animate-fade-in-up">
        <div className="relative rounded-2xl bg-gradient-neon p-[1px] ring-purple">
          <div className="rounded-2xl bg-background/85 p-6 relative overflow-hidden">
            <div className="scanline absolute inset-0 opacity-10 pointer-events-none" />
            <div className="flex items-center gap-2 text-primary">
              <WalletIcon className="size-4" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Balance</span>
            </div>
            <p className="mt-3 font-display text-5xl font-bold text-gradient-neon">
              {isLoading ? "—" : formatUsd(wallet?.balance_cents)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Available to play</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                onClick={() => setDepositOpen(true)}
                className="rounded-xl bg-primary py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground flex items-center justify-center gap-2 transition-transform active:scale-[0.97]"
              >
                <Plus className="size-4" />
                Deposit
              </button>
              <button
                onClick={() => toast.info("Payouts via Stripe Connect — coming next")}
                className="rounded-xl bg-surface ring-1 ring-border py-3 text-sm font-bold uppercase tracking-wider transition-transform active:scale-[0.97]"
              >
                Withdraw
              </button>
            </div>
          </div>
        </div>

        {depositOpen && (
          <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur overflow-y-auto">
            <div className="max-w-md mx-auto p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-2xl font-bold">Add funds</h2>
                <button onClick={closeAll} className="p-2 rounded-lg hover:bg-surface" aria-label="Close">
                  <X className="size-5" />
                </button>
              </div>

              {!checkoutAmount ? (
                <div className="space-y-4">
                  <label className="block text-xs uppercase tracking-wider text-muted-foreground">
                    Amount (USD)
                  </label>
                  <div className="flex items-center gap-2 rounded-xl bg-surface ring-1 ring-border px-4 py-3">
                    <span className="text-2xl font-bold text-muted-foreground">$</span>
                    <input
                      type="number"
                      min={5}
                      step={1}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="flex-1 bg-transparent text-2xl font-bold outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[10, 25, 50, 100].map((v) => (
                      <button
                        key={v}
                        onClick={() => setAmount(String(v))}
                        className="rounded-lg bg-surface ring-1 ring-border py-2 text-sm font-bold"
                      >
                        ${v}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={startCheckout}
                    className="w-full rounded-xl bg-primary py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground"
                  >
                    Continue to payment
                  </button>
                </div>
              ) : (
                <StripeDepositCheckout
                  amountCents={checkoutAmount}
                  returnUrl={`${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`}
                />
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <Mini label="Lifetime" value={formatUsd(lifetimePayouts)} tint="text-success" />
          <Mini
            label="This Week"
            value={`${weekNet >= 0 ? "+" : "−"}${formatUsd(Math.abs(weekNet))}`}
            tint={weekNet >= 0 ? "text-success" : "text-destructive"}
          />
          <Mini label="Pending" value="$0" />
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
                      {formatUsd(Math.abs(Number(t.amount_cents)))}
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
