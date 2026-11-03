import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { CheckCircle2, Clock, Target, Trophy, Users, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createChampCheckout, closeUnderfilledBrackets } from "@/lib/champ.functions";
import {
  CHAMP_CAPS, CHAMP_CUTOFF_MS, CHAMP_MIN_PLAYERS, CHAMP_POOL_CENTS,
  capEligibility, capLabel, completeTeams, payoutSplit, upcomingSlots,
} from "@/lib/champ";
import { useIsStaff, useMyProfile } from "@/lib/api";
import { trackApplovinEvent } from "@/lib/applovin";

export const Route = createFileRoute("/tournaments")({
  head: () => ({
    meta: [
      { title: "SMYD Champ Cricket Tournaments — GranBoard brackets every 30 min" },
      { name: "description", content: "Enter SMYD Champ Cricket skill tournaments on GranBoard. 16 MPR cap divisions, brackets every 30 minutes, $25 entry with $19 committed to the prize pool." },
      { property: "og:title", content: "SMYD Champ Cricket Tournaments" },
      { property: "og:description", content: "GranBoard Cricket brackets every 30 minutes across 16 MPR cap divisions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://smyd.online/tournaments" }],
  }),
  component: TournamentsPage,
});

type Entry = {
  cap: string; starts_at: string; user_id: string; username: string | null; display_name: string | null;
  avatar_url: string | null; country: string | null; cricket_mpr: number | null; mpr_verified: boolean;
  format: string; partner_id: string | null;
};

const usd = (c: number) => `$${(c / 100).toFixed(2)}`;
const fmtTime = (t: number) => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
function countdown(ms: number) {
  if (ms <= 0) return "Closed";
  const m = Math.floor(ms / 60000);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function TournamentsPage() {
  const qc = useQueryClient();
  const { data: me } = useMyProfile();
  const { data: staff } = useIsStaff();
  const [now, setNow] = useState(() => Date.now());
  const [filter, setFilter] = useState<string>("all");
  const [roster, setRoster] = useState<{ cap: string; t: number } | null>(null);
  const [pay, setPay] = useState<{ cap: string; t: number } | null>(null);
  const [format, setFormat] = useState<"singles" | "doubles">("singles");
  const [partner, setPartner] = useState("");
  const [payReady, setPayReady] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    if (new URLSearchParams(window.location.search).get("entered") === "1") setDone(true);
    closeUnderfilledBrackets().catch(() => {});
    return () => clearInterval(i);
  }, []);

  const slots = useMemo(() => upcomingSlots(Math.floor(now / 60000) * 60000, 8), [Math.floor(now / 60000)]);
  const board = useQuery({
    queryKey: ["champ-board", slots[0]],
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("champ_board", {
        _from: new Date(slots[0]).toISOString(),
        _to: new Date(slots[slots.length - 1]).toISOString(),
      });
      if (error) throw error;
      return (data ?? []) as Entry[];
    },
  });

  const byKey = useMemo(() => {
    const m = new Map<string, Entry[]>();
    for (const e of (board.data ?? []).filter((x) => (x.format ?? "singles") === format)) {
      const k = `${e.cap}|${new Date(e.starts_at).getTime()}`;
      m.set(k, [...(m.get(k) ?? []), e]);
    }
    return m;
  }, [board.data]);

  const myMpr = me?.cricket_mpr == null ? null : Number(me.cricket_mpr);
  const caps = filter === "all" ? CHAMP_CAPS : CHAMP_CAPS.filter((c) => c === filter);

  const fetchClientSecret = async () => {
    const r = await createChampCheckout({
      data: {
        cap: pay!.cap, startsAt: pay!.t, format, partnerUsername: format === "doubles" ? partner.trim() : undefined,
        returnUrl: `${window.location.origin}/tournaments?entered=1`,
        environment: getStripeEnvironment(),
      },
    });
    if ("error" in r) { toast.error(r.error); setPayReady(false); throw new Error(r.error); }
    return r.clientSecret;
  };

  const rosterList = roster ? byKey.get(`${roster.cap}|${roster.t}`) ?? [] : [];

  return (
    <AppShell>
      <div className="space-y-5 px-5 py-6 animate-fade-in-up">
        <section className="rounded-2xl bg-surface p-5 ring-1 ring-primary/40">
          <div className="flex items-center gap-2 text-primary"><Trophy className="h-5 w-5" /><span className="text-xs font-bold uppercase tracking-widest">SMYD Champ</span></div>
          <h1 className="mt-2 text-2xl font-black">Cricket Tournaments</h1>
          <p className="mt-1 text-sm text-muted-foreground">GranBoard remote play, plastic-tip only. A new bracket every 30 minutes in every division, worldwide.</p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
            <Stat label="Entry" value="$25.00" />
            <Stat label="Prize pool" value="$19.00" />
            <Stat label="SMYD fee" value="$6.00" />
          </div>
          <ul className="mt-4 space-y-1 text-xs text-muted-foreground">
            <li>• Cricket only · double elimination · Bo5 winners side, Bo3 losers side, Bo5 grand final</li>
            <li>• GranBoard piddle decides Game 1 and any tied deciding game; loser of the previous game throws first</li>
            <li>• Registration closes 30 minutes before start · minimum {CHAMP_MIN_PLAYERS} players or everyone is refunded to their card automatically</li>
            <li>• Pays top 2 (3–5 players), top 3 (6–12), top 4 (13+)</li>
          </ul>
        </section>

        {done && (
          <div className="flex items-center gap-2 rounded-xl bg-primary/15 p-3 text-sm ring-1 ring-primary/40">
            <CheckCircle2 className="h-4 w-4 text-primary" /> You're registered! Your name appears on the roster in a few seconds.
          </div>
        )}

        <MprCard mpr={myMpr} verified={!!me?.mpr_verified} signedIn={!!me} onSaved={() => qc.invalidateQueries()} />

        <div className="grid grid-cols-2 gap-2 rounded-xl bg-surface p-1 ring-1 ring-border">
          {(["singles", "doubles"] as const).map((f) => (
            <button key={f} onClick={() => setFormat(f)}
              className={`rounded-lg py-2 text-sm font-bold ${format === f ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              {f === "singles" ? "Singles" : "Doubles (2v2)"}
            </button>
          ))}
        </div>
        {format === "doubles" && (
          <p className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">Doubles: each teammate pays their own $25 and names the other. Your two MPRs added together must be at or below the cap. A team counts once both partners have paid. Minimum {CHAMP_MIN_PLAYERS} full teams, or everyone is refunded to their card.</p>
        )}

        <div className="flex gap-2 overflow-x-auto pb-1">
          {["all", ...CHAMP_CAPS].map((c) => (
            <button key={c} onClick={() => setFilter(c)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${filter === c ? "bg-primary text-primary-foreground ring-primary" : "bg-surface ring-border text-muted-foreground"}`}>
              {c === "all" ? "All caps" : capLabel(c)}
            </button>
          ))}
        </div>

        {slots.map((t) => (
          <section key={t} className="rounded-2xl bg-surface ring-1 ring-border">
            <header className="flex items-center justify-between border-b border-border/60 px-4 py-3">
              <div className="flex items-center gap-2 font-bold"><Clock className="h-4 w-4 text-primary" /> {fmtTime(t)}</div>
              <span className="text-xs text-muted-foreground">Registration closes in {countdown(t - CHAMP_CUTOFF_MS - now)}</span>
            </header>
            <div className="divide-y divide-border/50">
              {caps.map((cap) => {
                const list = byKey.get(`${cap}|${t}`) ?? [];
                const mine = list.some((e) => e.user_id === me?.id);
                const why = !me ? "Sign in to enter" : format === "singles" ? capEligibility(cap, myMpr, !!me.mpr_verified) : null;
                const teams = format === "doubles" ? completeTeams(list).length : 0;
                const count = format === "doubles" ? `${teams} teams${list.length - teams * 2 ? ` (+${list.length - teams * 2} pending partner)` : ""}` : `${list.length} registered`;
                return (
                  <div key={cap} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="w-20 text-sm font-bold">{capLabel(cap)}</div>
                    <button onClick={() => setRoster({ cap, t })} className="flex flex-1 items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                      <Users className="h-3.5 w-3.5" /> {count} · {usd((format === "doubles" ? teams * 2 : list.length) * CHAMP_POOL_CENTS)} pool
                    </button>
                    {mine ? (
                      <span className="text-xs font-semibold text-primary">Entered</span>
                    ) : !me ? (
                      <Link to="/login" className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">Sign in</Link>
                    ) : (
                      <button disabled={!!why} title={why ?? ""} onClick={() => { trackApplovinEvent("begin_checkout"); setPay({ cap, t }); setPayReady(format === "singles"); }}
                        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-40">
                        Enter $25
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        {staff && <StaffMprQueue />}
      </div>

      {roster && (
        <Modal onClose={() => setRoster(null)} title={`${capLabel(roster.cap)} · ${fmtTime(roster.t)}`}>
          <div className="mb-3">
            <div className="mb-1 flex justify-between text-xs"><span>{rosterList.length} / {CHAMP_MIN_PLAYERS} minimum</span><span>Pool {usd(rosterList.length * CHAMP_POOL_CENTS)}</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${Math.min(100, (rosterList.length / CHAMP_MIN_PLAYERS) * 100)}%` }} /></div>
            {payoutSplit(rosterList.length).length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">Payouts: {payoutSplit(rosterList.length).map((c, i) => `${i + 1}st ${usd(c)}`.replace("2st", "2nd").replace("3st", "3rd").replace("4st", "4th")).join(" · ")}</p>
            )}
          </div>
          {rosterList.length === 0 ? <p className="text-sm text-muted-foreground">No players yet — be the first.</p> : (
            <ul className="space-y-2">
              {rosterList.map((e) => (
                <li key={e.user_id} className="flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-xs font-bold">{(e.username ?? "?").slice(0, 2).toUpperCase()}</div>
                  <div className="flex-1 text-sm font-semibold">{e.display_name || e.username || "Player"} <span className="text-xs text-muted-foreground">{e.country ?? ""}</span>{format === "doubles" && <div className="text-xs font-normal text-muted-foreground">{e.partner_id && rosterList.some((x) => x.user_id === e.partner_id && x.partner_id === e.user_id) ? `Team with ${(() => { const m = rosterList.find((x) => x.user_id === e.partner_id); return m?.display_name || m?.username || "partner"; })()}` : "Pending partner"}</div>}</div>
                  <div className="text-right text-xs"><div className="font-bold">{e.cricket_mpr != null ? Number(e.cricket_mpr).toFixed(2) : "—"} MPR</div><div className={e.mpr_verified ? "text-primary" : "text-muted-foreground"}>{e.mpr_verified ? "Verified" : "Unverified"}</div></div>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}

      {pay && (
        <Modal onClose={() => setPay(null)} title={`Enter ${capLabel(pay.cap)} · ${fmtTime(pay.t)}`}>
          <p className="mb-3 text-xs text-muted-foreground">$25.00 entry per player · $19.00 to the prize pool · $6.00 SMYD fee. Refunded to your card automatically if the bracket doesn't reach {CHAMP_MIN_PLAYERS} {format === "doubles" ? "full teams" : "players"}{format === "doubles" ? " or your partner doesn't pay in time" : ""}.</p>
          {format === "doubles" && !payReady ? (
            <div className="space-y-2">
              <label className="text-xs font-semibold">Partner's SMYD username</label>
              <input value={partner} onChange={(e) => setPartner(e.target.value)} placeholder="username"
                className="w-full rounded-lg bg-muted/40 px-3 py-2 text-sm ring-1 ring-border" />
              <button disabled={partner.trim().length < 2} onClick={() => setPayReady(true)}
                className="w-full rounded-lg bg-primary py-2 text-sm font-bold text-primary-foreground disabled:opacity-40">Continue to pay $25</button>
            </div>
          ) : payReady ? (
            <EmbeddedCheckoutProvider key={`${format}-${partner}`} stripe={getStripe()} options={{ fetchClientSecret }}>
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          ) : null}
        </Modal>
      )}
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-muted/40 p-2"><div className="text-muted-foreground">{label}</div><div className="text-sm font-black">{value}</div></div>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 backdrop-blur-sm sm:items-center">
      <div className="max-h-[90vh] w-full max-w-[480px] overflow-y-auto rounded-t-2xl bg-surface p-5 ring-1 ring-primary/40 sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between"><h2 className="font-bold">{title}</h2><button onClick={onClose} aria-label="Close"><X className="h-5 w-5" /></button></div>
        {children}
      </div>
    </div>
  );
}

function MprCard({ mpr, verified, signedIn, onSaved }: { mpr: number | null; verified: boolean; signedIn: boolean; onSaved: () => void }) {
  const [val, setVal] = useState("");
  if (!signedIn) return null;
  const save = async () => {
    const n = Number(val);
    const { error } = await (supabase.rpc as any)("set_my_mpr", { _mpr: n });
    if (error) return toast.error(error.message);
    toast.success("MPR submitted — staff will verify it against your GranBoard stats.");
    setVal(""); onSaved();
  };
  return (
    <section className="rounded-2xl bg-surface p-4 ring-1 ring-border">
      <div className="flex items-center gap-2 text-sm font-bold"><Target className="h-4 w-4 text-primary" /> Your Cricket MPR</div>
      <p className="mt-1 text-sm">{mpr != null ? `${mpr.toFixed(2)} MPR · ${verified ? "Verified" : "Pending verification"}` : "Not submitted"}</p>
      <p className="mt-1 text-xs text-muted-foreground">Capped divisions need a verified MPR at or below the cap. Until then you can enter No Cap. Send a screenshot of your GranBoard Cricket stats to support@smyd.online to speed up verification.</p>
      <div className="mt-3 flex gap-2">
        <input value={val} onChange={(e) => setVal(e.target.value)} inputMode="decimal" placeholder="e.g. 2.75"
          className="flex-1 rounded-lg bg-muted/40 px-3 py-2 text-sm ring-1 ring-border" />
        <button onClick={save} disabled={!val} className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-40">Submit</button>
      </div>
    </section>
  );
}

function StaffMprQueue() {
  const q = useQuery({
    queryKey: ["mpr-queue"],
    queryFn: async () => {
      const { data } = await (supabase.from("profiles") as any).select("id, username, cricket_mpr").not("cricket_mpr", "is", null).eq("mpr_verified", false).limit(50);
      return (data ?? []) as { id: string; username: string | null; cricket_mpr: number }[];
    },
  });
  const verify = async (id: string) => {
    const { error } = await (supabase.rpc as any)("admin_set_mpr_verified", { _user_id: id, _verified: true });
    if (error) return toast.error(error.message);
    toast.success("MPR verified"); q.refetch();
  };
  return (
    <section className="rounded-2xl bg-surface p-4 ring-1 ring-accent/40">
      <h2 className="text-sm font-bold">Staff · MPR verification queue</h2>
      {(q.data ?? []).length === 0 ? <p className="mt-2 text-xs text-muted-foreground">Nothing pending.</p> : (
        <ul className="mt-2 space-y-2">{q.data!.map((p) => (
          <li key={p.id} className="flex items-center justify-between text-sm">
            <span>{p.username ?? p.id.slice(0, 8)} · {Number(p.cricket_mpr).toFixed(2)}</span>
            <button onClick={() => verify(p.id)} className="rounded bg-primary px-2 py-1 text-xs font-bold text-primary-foreground">Verify</button>
          </li>
        ))}</ul>
      )}
    </section>
  );
}
