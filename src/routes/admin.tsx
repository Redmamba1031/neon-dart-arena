import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Activity, AlertTriangle, Ban, Banknote, Coins, Gift, Shield, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  formatMoney,
  useAdminActions,
  useAdminAdjustCoins,
  useAllWithdrawals,
  useAdminMarkWithdrawalPaid,
  useAdminRejectWithdrawal,
  useAdminBanPlayer,
  useAdminRefundRedemption,
  useAdminResolveDispute,
  useAdminSetRole,
  useAdminUnbanPlayer,
  useAllBans,
  useAllRedemptions,
  useDisputedMatches,
  useIsStaff,
  useOpsSnapshot,
  usePlayerSearch,
  useProfilesByIds,
  useStaffList,
} from "@/lib/api";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Control — SMYD" },
      { name: "description", content: "Staff tools for SMYD: settle disputes, ban cheaters, adjust balances and review payouts." },
      { property: "og:title", content: "Admin Control — SMYD" },
      { property: "og:description", content: "Staff tools for SMYD: settle disputes, ban cheaters, adjust balances and review payouts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

const card = "rounded-xl bg-surface ring-1 ring-border p-4 space-y-3";
const inputCls =
  "w-full rounded-lg bg-background ring-1 ring-border px-3 py-2 text-sm outline-none focus:ring-primary";
const btn =
  "rounded-lg bg-primary px-3 py-2 text-xs font-bold uppercase tracking-widest text-primary-foreground disabled:opacity-40";

function err(e: unknown) {
  toast.error((e as { message?: string })?.message ?? "Something went wrong");
}

function AdminPage() {
  const { data: role, isLoading } = useIsStaff();

  if (isLoading) {
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
          <p className="text-sm text-muted-foreground">You don't have access to the control room.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="px-5 py-6 space-y-5 animate-fade-in-up">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">Control room</p>
          <h1 className="font-display text-3xl font-bold mt-1">Admin</h1>
        </div>

        <OpsPanel />
        <Disputes />
        <BanTool />
        <CoinTool />
        <Withdrawals />
        <Redemptions />
        {role.owner && <StaffTool />}
        <ActionLog />
      </div>
    </AppShell>
  );
}

/* ---------- ops monitoring ---------- */
function Stat({ label, value, alert }: { label: string; value: string | number; alert?: boolean }) {
  return (
    <div className={`rounded-lg bg-background ring-1 px-3 py-2 ${alert ? "ring-destructive" : "ring-border"}`}>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`font-display text-lg font-bold ${alert ? "text-destructive" : ""}`}>{value}</p>
    </div>
  );
}

function OpsPanel() {
  const { data, isLoading, refetch, isFetching } = useOpsSnapshot();
  const healthy = data?.health.status === "ok";

  return (
    <section className={card}>
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold">
          <Activity className="size-4 text-accent" /> System health
        </h2>
        <button className="text-xs text-muted-foreground underline" onClick={() => void refetch()} disabled={isFetching}>
          {isFetching ? "checking…" : "refresh"}
        </button>
      </div>

      {isLoading || !data ? (
        <p className="text-sm text-muted-foreground">Checking systems…</p>
      ) : (
        <>
          <div className="flex items-center gap-2 text-sm">
            <span className={`size-2 rounded-full ${healthy ? "bg-accent" : "bg-destructive"}`} />
            <span className="font-medium">{healthy ? "All systems operational" : "Backend degraded"}</span>
            <span className="text-xs text-muted-foreground">{data.health.latency_ms}ms</span>
          </div>
          {data.health.detail && <p className="text-xs text-destructive">{data.health.detail}</p>}

          <div className="grid grid-cols-2 gap-2">
            <Stat label="Overdue matches" value={data.stuckMatches.length} alert={data.stuckMatches.length > 0} />
            <Stat label="Open disputes" value={data.disputeCount} alert={data.disputeCount > 0} />
            <Stat label="Pending payouts" value={data.pendingPayouts} alert={data.pendingPayouts > 0} />
            <Stat label="Failed gift cards" value={data.failedGiftCards} alert={data.failedGiftCards > 0} />
          </div>

          {data.stuckMatches.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Past the 45-minute window</p>
              {data.stuckMatches.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded-lg bg-background ring-1 ring-border px-3 py-2 text-xs">
                  <span className="font-medium uppercase">{m.mode}</span>
                  <span className="text-muted-foreground">
                    {formatMoney(Number(m.stake_cents))} · {m.reported_winner_id ? "one report in" : "no report"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

/* ---------- player picker ---------- */
function PlayerPicker({ value, onPick }: { value: { id: string; label: string } | null; onPick: (p: { id: string; label: string } | null) => void }) {
  const [term, setTerm] = useState("");
  const { data: results = [] } = usePlayerSearch(term);

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-lg bg-background ring-1 ring-border px-3 py-2">
        <span className="text-sm font-medium">{value.label}</span>
        <button className="text-xs text-muted-foreground underline" onClick={() => onPick(null)}>
          change
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <input
        className={inputCls}
        placeholder="Search player by name"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
      />
      {results.length > 0 && (
        <div className="rounded-lg ring-1 ring-border divide-y divide-border/60 overflow-hidden">
          {results.map((p) => (
            <button
              key={p.id}
              className="w-full px-3 py-2 text-left text-sm hover:bg-background"
              onClick={() => {
                onPick({ id: p.id, label: p.display_name || p.username || "Player" });
                setTerm("");
              }}
            >
              {p.display_name || p.username}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- disputes ---------- */
function Disputes() {
  const { data: matches = [] } = useDisputedMatches();
  const ids = matches.flatMap((m) => [m.creator_id, m.opponent_id].filter(Boolean) as string[]);
  const { data: profiles } = useProfilesByIds(ids);
  const resolve = useAdminResolveDispute();

  const name = (id: string | null) => {
    if (!id) return "TBD";
    const p = profiles?.get(id);
    return p?.display_name || p?.username || "Player";
  };

  return (
    <section className={card}>
      <h2 className="flex items-center gap-2 font-display text-lg font-bold">
        <AlertTriangle className="size-4 text-destructive" /> Disputed matches
      </h2>
      {matches.length === 0 ? (
        <p className="text-sm text-muted-foreground">No disputes right now.</p>
      ) : (
        matches.map((m) => (
          <div key={m.id} className="rounded-lg bg-background ring-1 ring-border p-3 space-y-2">
            <p className="text-sm font-medium">
              {name(m.creator_id)} vs {name(m.opponent_id)}
            </p>
            <p className="text-xs text-muted-foreground">
              {m.mode} · Bo{m.best_of} · {formatMoney(m.stake_cents)} each
            </p>
            <div className="flex gap-2">
              {[m.creator_id, m.opponent_id].filter(Boolean).map((id) => (
                <button
                  key={id}
                  className={btn}
                  disabled={resolve.isPending}
                  onClick={() =>
                    resolve.mutate(
                      { matchId: m.id, winnerId: id as string, note: "Dispute settled by staff" },
                      {
                        onSuccess: () => toast.success("Match settled and paid out"),
                        onError: err,
                      },
                    )
                  }
                >
                  {name(id)} won
                </button>
              ))}
            </div>
          </div>
        ))
      )}
    </section>
  );
}

/* ---------- bans ---------- */
function BanTool() {
  const [player, setPlayer] = useState<{ id: string; label: string } | null>(null);
  const [reason, setReason] = useState("");
  const ban = useAdminBanPlayer();
  const unban = useAdminUnbanPlayer();
  const { data: bans = [] } = useAllBans();
  const { data: profiles } = useProfilesByIds(bans.map((b) => b.user_id));

  return (
    <section className={card}>
      <h2 className="flex items-center gap-2 font-display text-lg font-bold">
        <Ban className="size-4 text-destructive" /> Ban a player
      </h2>
      <PlayerPicker value={player} onPick={setPlayer} />
      <input className={inputCls} placeholder="Reason (shown in the log)" value={reason} onChange={(e) => setReason(e.target.value)} />
      <button
        className={btn}
        disabled={!player || reason.trim().length < 3 || ban.isPending}
        onClick={() =>
          ban.mutate(
            { userId: player!.id, reason: reason.trim() },
            {
              onSuccess: () => {
                toast.success(`${player!.label} is banned`);
                setPlayer(null);
                setReason("");
              },
              onError: err,
            },
          )
        }
      >
        Ban player
      </button>

      {bans.length > 0 && (
        <div className="space-y-2 pt-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Banned</p>
          {bans.map((b) => {
            const p = profiles?.get(b.user_id);
            return (
              <div key={b.user_id} className="flex items-center justify-between rounded-lg bg-background ring-1 ring-border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{p?.display_name || p?.username || "Player"}</p>
                  <p className="text-xs text-muted-foreground">{b.reason}</p>
                </div>
                <button
                  className="text-xs text-primary underline"
                  onClick={() => unban.mutate(b.user_id, { onSuccess: () => toast.success("Ban lifted"), onError: err })}
                >
                  unban
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ---------- coins ---------- */
function CoinTool() {
  const [player, setPlayer] = useState<{ id: string; label: string } | null>(null);
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState("");
  const adjust = useAdminAdjustCoins();

  return (
    <section className={card}>
      <h2 className="flex items-center gap-2 font-display text-lg font-bold">
        <Coins className="size-4 text-primary" /> Adjust balance
      </h2>
      <PlayerPicker value={player} onPick={setPlayer} />
      <input
        className={inputCls}
        type="number"
        placeholder="Amount in USD (use a minus sign to remove)"
        value={amount || ""}
        onChange={(e) => setAmount(Number(e.target.value))}
      />
      <input className={inputCls} placeholder="Reason" value={note} onChange={(e) => setNote(e.target.value)} />
      <button
        className={btn}
        disabled={!player || !amount || note.trim().length < 3 || adjust.isPending}
        onClick={() =>
          adjust.mutate(
            { userId: player!.id, amount: Math.round(amount * 100), note: note.trim() },
            {
              onSuccess: () => {
                toast.success(`${amount > 0 ? "Added" : "Removed"} ${formatMoney(Math.abs(amount) * 100)}`);
                setAmount(0);
                setNote("");
              },
              onError: err,
            },
          )
        }
      >
        Apply
      </button>
    </section>
  );
}

/* ---------- withdrawals ---------- */
function Withdrawals() {
  const { data: rows = [] } = useAllWithdrawals();
  const markPaid = useAdminMarkWithdrawalPaid();
  const reject = useAdminRejectWithdrawal();
  const { data: profiles } = useProfilesByIds(rows.map((r) => r.user_id));

  return (
    <section className={card}>
      <h2 className="flex items-center gap-2 font-display text-lg font-bold">
        <Banknote className="size-4 text-primary" /> Cash payouts
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No payout requests.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="rounded-lg bg-background ring-1 ring-border p-3 space-y-2">
              <p className="text-sm font-semibold">
                {formatMoney(Number(r.amount_cents))} · {r.method} · {r.destination}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {profiles?.get(r.user_id)?.display_name ?? profiles?.get(r.user_id)?.username ?? "Player"} ·{" "}
                {r.status} · {new Date(r.created_at).toLocaleString()}
              </p>
              {r.status === "pending" && (
                <div className="flex gap-2">
                  <button
                    className={btn}
                    disabled={markPaid.isPending}
                    onClick={() =>
                      markPaid.mutate(
                        { requestId: r.id },
                        { onSuccess: () => toast.success("Marked as sent"), onError: err },
                      )
                    }
                  >
                    Mark sent
                  </button>
                  <button
                    className={btn}
                    disabled={reject.isPending}
                    onClick={() => {
                      const reason = window.prompt("Reason for rejecting this payout?");
                      if (!reason) return;
                      reject.mutate(
                        { requestId: r.id, reason },
                        { onSuccess: () => toast.success("Rejected and refunded"), onError: err },
                      );
                    }}
                  >
                    Reject &amp; refund
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ---------- redemptions ---------- */
function Redemptions() {
  const { data: rows = [] } = useAllRedemptions();
  const refund = useAdminRefundRedemption();
  const { data: profiles } = useProfilesByIds(rows.map((r) => r.user_id));

  return (
    <section className={card}>
      <h2 className="flex items-center gap-2 font-display text-lg font-bold">
        <Gift className="size-4 text-accent" /> Gift card orders
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No redemptions yet.</p>
      ) : (
        rows.map((r) => {
          const p = profiles?.get(r.user_id);
          return (
            <div key={r.id} className="rounded-lg bg-background ring-1 ring-border p-3 space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  {p?.display_name || p?.username || "Player"} · ${(r.denomination_usd_cents / 100).toFixed(0)} {r.brand}
                </p>
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{r.status}</span>
              </div>
              <p className="text-xs text-muted-foreground">{r.delivery_email}</p>
              {r.status === "pending" && (
                <button
                  className="text-xs text-primary underline"
                  onClick={() =>
                    refund.mutate(
                      { redemptionId: r.id, reason: "Refunded by staff" },
                      { onSuccess: () => toast.success("Refunded"), onError: err },
                    )
                  }
                >
                  refund
                </button>
              )}
            </div>
          );
        })
      )}
    </section>
  );
}

/* ---------- staff ---------- */
function StaffTool() {
  const [player, setPlayer] = useState<{ id: string; label: string } | null>(null);
  const setRole = useAdminSetRole();
  const { data: staff = [] } = useStaffList();
  const { data: profiles } = useProfilesByIds(staff.map((s) => s.user_id));

  return (
    <section className={card}>
      <h2 className="flex items-center gap-2 font-display text-lg font-bold">
        <ShieldCheck className="size-4 text-primary" /> Admin access
      </h2>
      <PlayerPicker value={player} onPick={setPlayer} />
      <button
        className={btn}
        disabled={!player || setRole.isPending}
        onClick={() =>
          setRole.mutate(
            { userId: player!.id, grant: true },
            {
              onSuccess: () => {
                toast.success(`${player!.label} is now an admin`);
                setPlayer(null);
              },
              onError: err,
            },
          )
        }
      >
        Grant admin
      </button>
      <div className="space-y-2 pt-2">
        {staff.map((s) => {
          const p = profiles?.get(s.user_id);
          return (
            <div key={`${s.user_id}-${s.role}`} className="flex items-center justify-between rounded-lg bg-background ring-1 ring-border px-3 py-2">
              <p className="text-sm">
                {p?.display_name || p?.username || "Player"}{" "}
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{s.role}</span>
              </p>
              {s.role === "admin" && (
                <button
                  className="text-xs text-destructive underline"
                  onClick={() =>
                    setRole.mutate({ userId: s.user_id, grant: false }, { onSuccess: () => toast.success("Access removed"), onError: err })
                  }
                >
                  remove
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ---------- log ---------- */
function ActionLog() {
  const { data: rows = [] } = useAdminActions();
  return (
    <section className={card}>
      <h2 className="font-display text-lg font-bold">Recent staff activity</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing logged yet.</p>
      ) : (
        <div className="space-y-1">
          {rows.map((a) => (
            <p key={a.id} className="text-xs text-muted-foreground">
              <span className="text-foreground">{a.action.replace(/_/g, " ")}</span>
              {a.amount_cents ? ` · ${formatMoney(a.amount_cents)}` : ""}
              {a.note ? ` · ${a.note}` : ""} · {new Date(a.created_at).toLocaleString()}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
