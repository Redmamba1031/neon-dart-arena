import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, BadgeCheck, Ban, Cake, Search, Shield, ShieldCheck, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { getIdDocumentUrl, useAdminPlayers, useAdminSetAgeVerified, useIsStaff } from "@/lib/api";

export const Route = createFileRoute("/admin-players")({
  head: () => ({
    meta: [
      { title: "Players & Verification — SMYD Admin" },
      { name: "description", content: "Staff roster of every SMYD player with real name and age verification status." },
      { property: "og:title", content: "Players & Verification — SMYD Admin" },
      { property: "og:description", content: "Staff roster of every SMYD player with real name and age verification status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPlayersPage,
});

function AdminPlayersPage() {
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
      <Roster />
    </AppShell>
  );
}

function Roster() {
  const { data: players = [], isLoading } = useAdminPlayers();
  const verify = useAdminSetAgeVerified();
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return players;
    return players.filter((p) =>
      [p.username, p.display_name, p.legal_name, p.email]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(needle)),
    );
  }, [players, q]);

  const verifiedCount = players.filter((p) => p.age_verified).length;
  const missingIdentity = players.filter((p) => !p.id_document_path).length;

  const toggle = async (userId: string, verified: boolean) => {
    try {
      await verify.mutateAsync({ userId, verified });
      toast.success(verified ? "Age verified" : "Verification removed");
    } catch (e) {
      toast.error((e as { message?: string })?.message ?? "Something went wrong");
    }
  };

  const viewId = async (path: string) => {
    const w = window.open("", "_blank");
    try {
      const url = await getIdDocumentUrl(path);
      if (w) w.location.href = url; else window.location.href = url;
    } catch (e) {
      w?.close();
      toast.error((e as { message?: string })?.message ?? "Could not open ID");
    }
  };

  return (
    <div className="px-5 py-6 space-y-5 animate-fade-in-up">
      <div>
        <Link to="/admin" className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary">
          <ArrowLeft className="size-3" /> Control room
        </Link>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent mt-2">Control room</p>
        <h1 className="font-display text-3xl font-bold mt-1">Players</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Every signed-up player, their real name and age verification.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat icon={Users} label="Players" value={String(players.length)} />
        <Stat icon={BadgeCheck} label="Age verified" value={String(verifiedCount)} />
        <Stat icon={Cake} label="No ID on file" value={String(missingIdentity)} />
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, username or email…"
          className="w-full rounded-lg bg-background ring-1 ring-border pl-9 pr-3 py-2 text-sm outline-none focus:ring-primary"
        />
      </div>

      {isLoading ? (
        <p className="text-center text-sm text-muted-foreground py-6">Loading players…</p>
      ) : filtered.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-6">No players match.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => {
            const name = p.display_name || p.username || "Player";
            const dob = p.date_of_birth
              ? new Date(`${p.date_of_birth}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
              : null;
            return (
              <div key={p.user_id} className="rounded-xl bg-surface ring-1 ring-border p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">
                      {p.legal_name ?? <span className="text-muted-foreground italic">No real name on file</span>}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {name}
                      {p.username ? ` · @${p.username}` : ""}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">{p.email ?? "—"}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {p.banned && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 text-destructive px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                        <Ban className="size-3" /> Banned
                      </span>
                    )}
                    {p.age_verified ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 text-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                        <BadgeCheck className="size-3" /> 18+ verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 text-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                        Unverified
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
                  <span>
                    {dob ? `Born ${dob}${p.age != null ? ` · ${p.age} yrs` : ""}` : "No date of birth on file"}
                  </span>
                  <span>{p.wins}W · {p.losses}L</span>
                </div>

                {p.id_document_path ? (
                  <button
                    onClick={() => viewId(p.id_document_path!)}
                    className="w-full rounded-lg bg-background ring-1 ring-border px-3 py-2 text-xs font-bold uppercase tracking-widest"
                  >
                    View photo ID — check name &amp; DOB match
                  </button>
                ) : (
                  <p className="text-[10px] text-accent text-center">No photo ID uploaded yet.</p>
                )}
                <button
                  disabled={verify.isPending || (!p.age_verified && (!p.legal_name || !p.date_of_birth || !p.id_document_path))}
                  onClick={() => toggle(p.user_id, !p.age_verified)}
                  className="w-full rounded-lg bg-primary px-3 py-2 text-xs font-bold uppercase tracking-widest text-primary-foreground disabled:opacity-40 inline-flex items-center justify-center gap-2"
                >
                  <ShieldCheck className="size-4" />
                  {p.age_verified ? "Remove verification" : "Mark age verified"}
                </button>
                {(!p.legal_name || !p.date_of_birth) && (
                  <p className="text-[10px] text-muted-foreground text-center">
                    Player must add their real name and date of birth on their profile first.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface ring-1 ring-border p-3 text-center space-y-1">
      <Icon className="mx-auto size-4 text-primary" />
      <p className="font-display text-lg font-bold leading-none">{value}</p>
      <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
    </div>
  );
}
