import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Activity, AlertTriangle, Ban, Banknote, Coins, Shield, ShieldCheck, TrendingUp, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  formatMoney,
  useAdminActions,
  useAdminAdjustCoins,
  useAllWithdrawals,
  useAdminMarkWithdrawalPaid,
  useAdminRejectWithdrawal,
  useAdminApproveWithdrawal,
  useAdminReleaseWithdrawalNow,
  useAdminRetryWithdrawal,

  useRunDuePayouts,
  useAdminBanPlayer,
  useAdminResolveDispute,
  useAdminSetRole,
  useAdminUnbanPlayer,
  useAllBans,
  useDisputedMatches,
  useIsStaff,
  useOpsSnapshot,
  usePlayerSearch,
  useProfilesByIds,
  useStaffList,
  useServiceFeeEarnings,
  PAYOUT_STEP_CENTS,
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

        <Link
          to="/admin-players"
          className="flex items-center gap-3 rounded-xl bg-surface ring-1 ring-border p-4 hover:ring-primary/40 transition-all"
        >
          <div className="size-10 rounded-lg bg-primary/15 grid place-items-center text-primary">
            <Users className="size-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Players & verification</p>
            <p className="text-[11px] text-muted-foreground">Real names, ages and age-verification status</p>
          </div>
        </Link>

        <EarningsPanel />
        <OpsPanel />
        <Disputes />
        <BanTool />
        <CoinTool />
        <Withdrawals />
        {role.owner && <StaffTool />}
        <ActionLog />
      </div>
    </AppShell>
  );
}

/* ---------- service fee earnings ---------- */
function EarningsPanel() {
  const { data, isLoading } = useServiceFeeEarnings();
  const milestones = data?.milestones ?? 0;

  useEffect(() => {
    if (!data || milestones < 1) return;
    const key = "smyd-payout-milestone-seen";
    const seen = Number(localStorage.getItem(key) ?? "0");
    if (milestones > seen) {
      localStorage.setItem(key, String(milestones));
      toast.success(`Payout ready: ${formatMoney(milestones * PAYOUT_STEP_CENTS)} in service fees earned`, {
        description: "You've passed another $100 in earnings.",
        duration: 8000,
      });
    }
  }, [data, milestones]);

  const pct = data ? Math.round((data.towardNextCents / PAYOUT_STEP_CENTS) * 100) : 0;

  return (
    <section className={card}>
      <h2 className="flex items-center gap-2 font-display text-lg font-bold">
        <TrendingUp className="size-4 text-accent" /> Service fee earnings
      </h2>
      {isLoading || !data ? (
        <p className="text-sm text-muted-foreground">Loading earnings…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Total earned" value={formatMoney(data.totalCents)} />
            <Stat label="$100 milestones" value={milestones} />
          </div>
          <div className="space-y-1">
            <div className="h-2 w-full overflow-hidden rounded-full bg-background ring-1 ring-border">
              <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-xs text-muted-foreground">
              {formatMoney(data.towardNextCents)} toward the next {formatMoney(PAYOUT_STEP_CENTS)} · next alert at{" "}
              {formatMoney(data.nextMilestoneCents)}
            </p>
          </div>
        </>
      )}
    </section>
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
          </div>

          {data.stuckMatches.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Past the 2-hour window</p>
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
const PAYOUT_STATUSES = ["all", "pending", "approved", "processing", "paid", "failed", "rejected"] as const;
const PAYOUT_METHODS = ["all", "paypal", "venmo", "bank", "cashapp"] as const;

function Withdrawals() {
  const { data: rows = [] } = useAllWithdrawals();
  const markPaid = useAdminMarkWithdrawalPaid();
  const reject = useAdminRejectWithdrawal();
  const approve = useAdminApproveWithdrawal();
  const releaseNow = useAdminReleaseWithdrawalNow();
  const retry = useAdminRetryWithdrawal();
  const runPayouts = useRunDuePayouts();
  const { data: profiles } = useProfilesByIds(rows.map((r) => r.user_id));
  const [providers, setProviders] = useState<{ paypal: boolean; paypalError: string | null } | null>(null);
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<(typeof PAYOUT_STATUSES)[number]>("all");
  const [methodFilter, setMethodFilter] = useState<(typeof PAYOUT_METHODS)[number]>("all");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const checkProviders = async () => {
    setChecking(true);
    try {
      const { checkPayoutProviders } = await import("@/lib/payouts.functions");
      const res = await checkPayoutProviders();
      setProviders({ paypal: res.paypal, paypalError: res.paypalError ?? null });
      if (res.paypal) toast.success("PayPal payouts connected");
      else toast.error(res.paypalError ?? "PayPal not connected");
    } catch (e) {
      err(e as Error);
    } finally {
      setChecking(false);
    }
  };

  const nameOf = (userId: string) =>
    profiles?.get(userId)?.display_name ?? profiles?.get(userId)?.username ?? "Player";

  const q = search.trim().toLowerCase();
  const filtered = rows.filter((r) => {
    if (status !== "all" && r.status !== status) return false;
    if (methodFilter !== "all" && r.method !== methodFilter) return false;
    if (!q) return true;
    return (
      nameOf(r.user_id).toLowerCase().includes(q) ||
      String(r.destination ?? "").toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q)
    );
  });

  const totalCents = filtered.reduce((s, r) => s + Number(r.amount_cents ?? 0), 0);

  const exportCsv = () => {
    const head = [
      "id", "player", "amount_usd", "method", "destination", "status",
      "provider", "provider_payout_id", "attempts", "requires_review",
      "risk_flags", "failure_reason", "hold_until", "created_at", "processed_at",
    ];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const body = filtered.map((r) => {
      const row = r as Record<string, any>;
      return [
        r.id, nameOf(r.user_id), (Number(r.amount_cents) / 100).toFixed(2), r.method, r.destination,
        r.status, row.provider, row.provider_payout_id, row.attempts, row.requires_review,
        (row.risk_flags ?? []).join(" | "), row.failure_reason, row.hold_until, r.created_at, row.processed_at,
      ].map(esc).join(",");
    });
    const blob = new Blob([[head.join(","), ...body].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `smyd-payouts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const chip = (on: boolean) =>
    `rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ring-1 ${
      on ? "bg-primary/10 ring-primary text-primary" : "ring-border text-muted-foreground"
    }`;

  return (
    <section className={card}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold">
          <Banknote className="size-4 text-primary" /> Cash payouts
        </h2>
        <button
          className={btn}
          disabled={runPayouts.isPending}
          onClick={() =>
            runPayouts.mutate(undefined, {
              onSuccess: (res: { paid?: number; failed?: number }) =>
                toast.success(`Sent ${res.paid ?? 0}, failed ${res.failed ?? 0}`),
              onError: err,
            })
          }
        >
          Send due now
        </button>
      </div>
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <button className={btn} disabled={checking} onClick={checkProviders}>
          {checking ? "Checking…" : "Check PayPal"}
        </button>
        {providers ? (
          <span className={providers.paypal ? "text-primary" : "text-destructive"}>
            {providers.paypal ? "PayPal & Venmo ready" : providers.paypalError ?? "PayPal not connected"}
          </span>
        ) : (
          <span>PayPal &amp; Venmo send automatically · bank/debit via Stripe</span>
        )}
      </div>

      {/* filters */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {PAYOUT_STATUSES.map((s) => (
            <button key={s} className={chip(status === s)} onClick={() => setStatus(s)}>
              {s === "all" ? "All statuses" : s}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PAYOUT_METHODS.map((m) => (
            <button key={m} className={chip(methodFilter === m)} onClick={() => setMethodFilter(m)}>
              {m === "all" ? "All methods" : m}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            className={inputCls}
            placeholder="Search player, destination or request id"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className={btn} onClick={exportCsv} disabled={filtered.length === 0}>
            Export CSV
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {filtered.length} of {rows.length} requests · {formatMoney(totalCents)} total
        </p>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No payout requests match these filters.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const row = r as typeof r & {
              hold_until?: string | null;
              risk_flags?: string[] | null;
              requires_review?: boolean | null;
              failure_reason?: string | null;
              provider?: string | null;
              provider_payout_id?: string | null;
              attempts?: number | null;
              processed_at?: string | null;
              approved_at?: string | null;
              note?: string | null;
            };
            const held = row.hold_until ? new Date(row.hold_until) : null;
            const onHold = held ? held.getTime() > Date.now() : false;
            const open = openId === r.id;
            const retryable =
              ["failed", "processing"].includes(r.status) ||
              (r.status === "approved" && (row.attempts ?? 0) > 0);
            return (
              <div key={r.id} className="rounded-lg bg-background ring-1 ring-border p-3 space-y-2">
                <button className="w-full text-left" onClick={() => setOpenId(open ? null : r.id)}>
                  <p className="text-sm font-semibold">
                    {formatMoney(Number(r.amount_cents))} · {r.method} · {r.destination}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {nameOf(r.user_id)} · {r.status} · {new Date(r.created_at).toLocaleString()}
                    {held ? ` · ${onHold ? "holds until" : "released"} ${held.toLocaleString()}` : ""}
                    {row.provider ? ` · via ${row.provider}` : ""}
                  </p>
                </button>
                {(row.risk_flags?.length ?? 0) > 0 && (
                  <p className="text-[11px] font-semibold text-destructive">
                    Flags: {row.risk_flags!.join(", ")}
                    {row.requires_review ? " · needs approval" : ""}
                  </p>
                )}
                {row.failure_reason && (
                  <p className="text-[11px] text-destructive">Last error: {row.failure_reason}</p>
                )}

                {open && (
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-lg bg-surface/60 p-2 text-[11px] text-muted-foreground">
                    <dt>Request id</dt><dd className="truncate text-foreground">{r.id}</dd>
                    <dt>Player id</dt><dd className="truncate text-foreground">{r.user_id}</dd>
                    <dt>Provider ref</dt><dd className="truncate text-foreground">{row.provider_payout_id ?? "—"}</dd>
                    <dt>Send attempts</dt><dd className="text-foreground">{row.attempts ?? 0}</dd>
                    <dt>Approved</dt>
                    <dd className="text-foreground">{row.approved_at ? new Date(row.approved_at).toLocaleString() : "—"}</dd>
                    <dt>Processed</dt>
                    <dd className="text-foreground">{row.processed_at ? new Date(row.processed_at).toLocaleString() : "—"}</dd>
                    <dt>Note</dt><dd className="text-foreground">{row.note ?? "—"}</dd>
                  </dl>
                )}

                <div className="flex flex-wrap gap-2">
                  {retryable && (
                    <button
                      className={btn}
                      disabled={retry.isPending}
                      onClick={() =>
                        retry.mutate(
                          { requestId: r.id },
                          { onSuccess: () => toast.success("Queued for another send"), onError: err },
                        )
                      }
                    >
                      Retry payout
                    </button>
                  )}
                  {r.status !== "paid" && r.status !== "rejected" && (
                    <>
                      {r.status === "pending" && (
                        <button
                          className={btn}
                          disabled={approve.isPending}
                          onClick={() =>
                            approve.mutate(
                              { requestId: r.id },
                              { onSuccess: () => toast.success("Approved"), onError: err },
                            )
                          }
                        >
                          Approve
                        </button>
                      )}
                      <button
                        className={btn}
                        disabled={releaseNow.isPending}
                        onClick={() =>
                          releaseNow.mutate(
                            { requestId: r.id },
                            { onSuccess: () => toast.success("Hold cleared — sends on next run"), onError: err },
                          )
                        }
                      >
                        Release now
                      </button>
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
                        Mark sent by hand
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
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
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
