import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ArrowDownLeft, ArrowUpRight, Plus, Wallet as WalletIcon } from "lucide-react";

export const Route = createFileRoute("/wallet")({
  head: () => ({
    meta: [
      { title: "Wallet — SMYD" },
      { name: "description", content: "Manage your SMYD wallet, deposits, and payouts." },
    ],
  }),
  component: Wallet,
});

const txns = [
  { id: 1, type: "win", desc: "501 vs Ghost_99", amount: 95, date: "2h ago" },
  { id: 2, type: "deposit", desc: "Card deposit", amount: 200, date: "Yesterday" },
  { id: 3, type: "loss", desc: "Cricket vs Triple20King", amount: -25, date: "Yesterday" },
  { id: 4, type: "win", desc: "501 vs Bullseye", amount: 38, date: "3d ago" },
  { id: 5, type: "withdraw", desc: "Payout to bank", amount: -150, date: "1w ago" },
];

function Wallet() {
  return (
    <AppShell>
      <div className="px-5 py-6 space-y-6 animate-fade-in-up">
        {/* Balance card */}
        <div className="relative rounded-2xl bg-gradient-neon p-[1px] ring-purple">
          <div className="rounded-2xl bg-background/85 p-6 relative overflow-hidden">
            <div className="scanline absolute inset-0 opacity-10 pointer-events-none" />
            <div className="flex items-center gap-2 text-primary">
              <WalletIcon className="size-4" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Balance</span>
            </div>
            <p className="mt-3 font-display text-5xl font-bold text-gradient-neon">$1,240.50</p>
            <p className="mt-1 text-xs text-muted-foreground">Available to play</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button className="rounded-xl bg-primary py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground flex items-center justify-center gap-2 transition-transform active:scale-[0.97]">
                <Plus className="size-4" /> Deposit
              </button>
              <button className="rounded-xl bg-surface ring-1 ring-border py-3 text-sm font-bold uppercase tracking-wider transition-transform active:scale-[0.97]">
                Withdraw
              </button>
            </div>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-3">
          <Mini label="Lifetime" value="$4.2k" tint="text-success" />
          <Mini label="This Week" value="+$320" tint="text-primary" />
          <Mini label="Pending" value="$0" />
        </div>

        {/* Transactions */}
        <div>
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Recent Activity
          </h3>
          <div className="rounded-xl bg-surface ring-1 ring-border divide-y divide-border/60">
            {txns.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                <div className={`size-9 rounded-lg grid place-items-center ${
                  t.amount > 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                }`}>
                  {t.amount > 0 ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{t.desc}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.date}</p>
                </div>
                <span className={`font-display text-sm font-semibold ${
                  t.amount > 0 ? "text-success" : "text-foreground"
                }`}>
                  {t.amount > 0 ? "+" : ""}${Math.abs(t.amount)}
                </span>
              </div>
            ))}
          </div>
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
