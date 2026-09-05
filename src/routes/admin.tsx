import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { AlertTriangle, Ban, Coins, Gift, Shield, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  formatMoney,
  useAdminActions,
  useAdminAdjustCoins,
  useAdminBanPlayer,
  useAdminRefundRedemption,
  useAdminResolveDispute,
  useAdminSetRole,
  useAdminUnbanPlayer,
  useAllBans,
  useAllRedemptions,
  useDisputedMatches,
  useIsStaff,
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

        <Disputes />
        <BanTool />
        <CoinTool />
        <Redemptions />
        {role.owner && <StaffTool />}
        <ActionLog />
      </div>
    </AppShell>
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
            { userId: player!.id, amount, note: note.trim() },
            {
              onSuccess: () => {
                toast.success(`${amount > 0 ? "Added" : "Removed"} ${formatMoney(Math.abs(amount))}`);
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
