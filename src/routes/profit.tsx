import { createFileRoute } from "@tanstack/react-router";
import { Clock, PiggyBank, Shield, TrendingUp, Wallet } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  formatMoney,
  useIsStaff,
  useMyWithdrawals,
  useServiceFeeEarnings,
  useWallet,
} from "@/lib/api";

export const Route = createFileRoute("/profit")({
  head: () => ({
    meta: [
      { title: "Profit Tracker — SMYD" },
      { name: "description", content: "Track SMYD service-fee profit, available balance and cash-outs still in the security hold." },
      { property: "og:title", content: "Profit Tracker — SMYD" },
      { property: "og:description", content: "Track SMYD service-fee profit, available balance and cash-outs still in the security hold." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfitPage,
});

const card = "rounded-xl bg-surface ring-1 ring-border p-4 space-y-3";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-background ring-1 ring-border px-3 py-2">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="font-display text-lg font-bold">{value}</p>
    </div>
  );
}

function ProfitPage() {
  const { data: role, isLoading: roleLoading } = useIsStaff();
  const { data: earnings, isLoading: earningsLoading } = useServiceFeeEarnings();
  const { data: wallet } = useWallet();
  const { data: withdrawals } = useMyWithdrawals();

  if (roleLoading) {
    return (
      <AppShell>
        <div className="px-5 py-10 text-center text-sm text-muted-foreground">Checking access…</div>
      </AppShell>
    );
  }

  if (!role?.staff) {
    return (
      <AppShell>
        <div className="px-5 py-10 space-y-3 text-center">
          <Shield className="mx-auto size-8 text-muted-foreground" />
          <h1 className="font-display text-xl font-bold">Staff only</h1>
          <p className="text-sm text-muted-foreground">You don't have access to the profit tracker.</p>
        </div>
      </AppShell>
    );
  }

  const now = Date.now();
  const onHold = (withdrawals ?? []).filter(
    (w) =>
      (w.status === "pending" || w.status === "approved") &&
      w.hold_until &&
      new Date(w.hold_until).getTime() > now,
  );
  const holdCents = onHold.reduce((sum, w) => sum + Number(w.amount_cents ?? 0), 0);
  const sending = (withdrawals ?? []).filter(
    (w) => w.status === "approved" && (!w.hold_until || new Date(w.hold_until).getTime() <= now),
  );
  const paidCents = (withdrawals ?? [])
    .filter((w) => w.status === "paid")
    .reduce((sum, w) => sum + Number(w.amount_cents ?? 0), 0);

  return (
    <AppShell>
      <div className="px-5 py-6 space-y-5 animate-fade-in-up">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">Owner</p>
          <h1 className="font-display text-3xl font-bold mt-1">Profit tracker</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your 10% service fee from every match, and where that money is right now.
          </p>
        </div>

        <section className={card}>
          <h2 className="flex items-center gap-2 font-display text-lg font-bold">
            <TrendingUp className="size-4 text-accent" /> Service fee profit
          </h2>
          {earningsLoading || !earnings ? (
            <p className="text-sm text-muted-foreground">Loading profit…</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Total profit earned" value={formatMoney(earnings.totalCents)} />
              <Stat label="$100 milestones" value={earnings.milestones} />
              <Stat label="Toward next $100" value={formatMoney(earnings.towardNextCents)} />
              <Stat label="Next alert at" value={formatMoney(earnings.nextMilestoneCents)} />
            </div>
          )}
        </section>

        <section className={card}>
          <h2 className="flex items-center gap-2 font-display text-lg font-bold">
            <Wallet className="size-4 text-accent" /> Available balance
          </h2>
          <p className="font-display text-3xl font-bold">{formatMoney(wallet?.balance_cents ?? 0)}</p>
          <p className="text-xs text-muted-foreground">
            Profit sitting in your account right now, ready to cash out from the Cashier.
          </p>
        </section>

        <section className={card}>
          <h2 className="flex items-center gap-2 font-display text-lg font-bold">
            <Clock className="size-4 text-accent" /> In the 72-hour hold
          </h2>
          <p className="font-display text-3xl font-bold">{formatMoney(holdCents)}</p>
          <p className="text-xs text-muted-foreground">
            Cash-outs waiting out the security hold before the money is sent.
          </p>
          {onHold.length === 0 ? (
            <p className="text-sm text-muted-foreground">No cash-outs on hold.</p>
          ) : (
            <ul className="space-y-2">
              {onHold.map((w) => (
                <li
                  key={w.id}
                  className="flex items-center justify-between rounded-lg bg-background ring-1 ring-border px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-semibold">{formatMoney(w.amount_cents)}</p>
                    <p className="text-[11px] text-muted-foreground capitalize">
                      {w.method} · releases {new Date(w.hold_until!).toLocaleString()}
                    </p>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">On hold</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={card}>
          <h2 className="flex items-center gap-2 font-display text-lg font-bold">
            <PiggyBank className="size-4 text-accent" /> Already paid out
          </h2>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Sent to you" value={formatMoney(paidCents)} />
            <Stat label="Sending now" value={sending.length} />
          </div>
        </section>
      </div>
    </AppShell>
  );
}
