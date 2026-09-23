import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { MessageSquare, Settings, LogOut, Target, ChevronRight, Coins, KeyRound, Loader2, MapPin, Crosshair, BadgeCheck } from "lucide-react";
import { useMyProfile, useLeaderboard, useUpdateProfile, useWallet, formatMoney, useUpdateLocation, useRestrictedRegions, useMyCoords, useSetMyIdentity } from "@/lib/api";
import { US_STATES, getDeviceLocation, locationLabel, stateName } from "@/lib/geo";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";


export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — SMYD" },
      { name: "description", content: "Your SMYD player profile and stats." },
    ],
  }),
  component: Profile,
});

function Profile() {
  const navigate = useNavigate();
  const { data: profile } = useMyProfile();
  const { data: leaderboard = [] } = useLeaderboard(500);

  const { data: wallet } = useWallet();
  const [editing, setEditing] = useState(false);

  const me = leaderboard.find((l) => l.user_id === profile?.id);
  const wins = me?.wins ?? 0;
  const losses = me?.losses ?? 0;
  const total = me?.matches_played ?? 0;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
  const rank = profile ? leaderboard.findIndex((l) => l.user_id === profile.id) + 1 : 0;

  const sendReset = async () => {
    const { data } = await supabase.auth.getUser();
    const email = data.user?.email;
    if (!email) return toast.error("No email on this account");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error(error.message);
    else toast.success("Password reset link sent to your email");
  };

  const name = profile?.display_name || profile?.username || "Player";
  const initials = name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/login" });
  };

  return (
    <AppShell>
      <div className="px-5 py-6 space-y-6 animate-fade-in-up">
        <div className="relative rounded-2xl bg-gradient-neon p-[1px]">
          <div className="rounded-2xl bg-background/90 p-6 relative overflow-hidden">
            <div className="absolute inset-0 scanline opacity-10 pointer-events-none" />
            <div className="flex items-center gap-4 relative">
              <div className="size-20 rounded-2xl bg-surface ring-2 ring-primary/60 grid place-items-center font-display text-2xl font-bold text-primary overflow-hidden">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt={name} className="size-full object-cover" />
                ) : (
                  initials || "P"
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                  {rank > 0 ? `Rank #${rank}` : "Unranked"}
                </p>
                <h2 className="font-display text-2xl font-bold mt-1 truncate">{name}</h2>
                <p className="text-xs text-muted-foreground">
                  {profile?.username ? `@${profile.username}` : "Member"}
                </p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-4 gap-2 relative">
              <Stat label="Wins" value={String(wins)} />
              <Stat label="Losses" value={String(losses)} />
              <Stat label="Win %" value={`${winRate}%`} tint="text-primary" />
              <Stat label="Played" value={String(total)} tint="text-accent" />
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-surface ring-1 ring-border p-4 flex items-center gap-3">
          <div className="size-10 rounded-lg bg-accent/15 grid place-items-center text-accent">
            <Coins className="size-5" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Account balance</p>
            <p className="font-display text-xl font-bold">{formatMoney(wallet?.balance_cents ?? 0)}</p>
          </div>
          <Link to="/shop" className="text-[11px] font-bold uppercase tracking-wider text-primary">
            Shop
          </Link>
        </div>

        <LocationCard profile={profile} />

        <IdentityCard profile={profile} />

        {editing && <EditProfile onDone={() => setEditing(false)} initial={{ username: profile?.username ?? "", display_name: profile?.display_name ?? "", avatar_url: profile?.avatar_url ?? "" }} />}


        <Link
          to="/messages"
          className="block rounded-xl bg-surface ring-1 ring-border p-4 hover:ring-primary/40 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-primary/15 grid place-items-center text-primary">
              <MessageSquare className="size-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Messages</p>
              <p className="text-[11px] text-muted-foreground">Chat with players</p>
            </div>
            <ChevronRight className="size-4 text-muted-foreground" />
          </div>
        </Link>

        <Section title="Tournaments">
          <Pref icon={Target} label="Cups Won" sub={`${wins} wins`} />
        </Section>

        <div className="space-y-2">
          <Action icon={Settings} label={editing ? "Close editor" : "Edit profile"} onClick={() => setEditing((v) => !v)} />
          <Action icon={KeyRound} label="Reset password" onClick={sendReset} />
          <Action icon={LogOut} label="Sign Out" danger onClick={handleSignOut} />
        </div>
      </div>
    </AppShell>
  );
}

function LocationCard({ profile }: { profile: ReturnType<typeof useMyProfile>["data"] }) {
  const update = useUpdateLocation();
  const { data: restricted = [] } = useRestrictedRegions();
  const { data: myCoords } = useMyCoords();
  const [state, setState] = useState(profile?.region_code ?? "");
  const [city, setCity] = useState(profile?.city ?? "");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [locating, setLocating] = useState(false);
  const savedCoords = coords ?? (myCoords?.lat != null && myCoords?.lng != null ? { lat: myCoords.lat, lng: myCoords.lng } : null);
  const [touched, setTouched] = useState(false);

  const current = touched ? state : profile?.region_code ?? state;
  const blocked = restricted.find((r) => r.code === current);

  const useDevice = async () => {
    setLocating(true);
    try {
      const pos = await getDeviceLocation();
      setCoords(pos);
      toast.success("Location captured — confirm your state and save");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not get your location");
    } finally {
      setLocating(false);
    }
  };

  const save = async () => {
    if (!state) return toast.error("Pick your state first");
    try {
      await update.mutateAsync({
        region_code: state,
        region_name: stateName(state),
        city,
        lat: savedCoords?.lat ?? null,
        lng: savedCoords?.lng ?? null,
        source: coords ? "device" : "manual",
      });
      toast.success("Location saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save your location");
    }
  };

  return (
    <div className="rounded-xl bg-surface ring-1 ring-border p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-lg bg-primary/15 grid place-items-center text-primary">
          <MapPin className="size-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Location</p>
          <p className="text-sm font-semibold">
            {locationLabel(profile) ?? "Not set — required to play for money"}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={useDevice}
        disabled={locating}
        className="w-full rounded-lg bg-background ring-1 ring-border py-2.5 text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {locating ? <Loader2 className="size-4 animate-spin" /> : <Crosshair className="size-4" />}
        {savedCoords ? "Location detected" : "Use my current location"}
      </button>

      <label className="block">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">State</span>
        <select
          value={state}
          onChange={(e) => { setState(e.target.value); setTouched(true); }}
          className="mt-1 w-full rounded-lg bg-background ring-1 ring-border px-3 py-2 text-sm"
        >
          <option value="">Select your state…</option>
          {US_STATES.map((s) => (
            <option key={s.code} value={s.code}>{s.name}</option>
          ))}
        </select>
      </label>

      <EditField label="City" value={city} onChange={setCity} placeholder="Indianapolis" />

      {blocked && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-[11px] text-destructive ring-1 ring-destructive/30">
          Real-money play is not available in {blocked.name}. {blocked.reason}
        </p>
      )}

      <button
        onClick={save}
        disabled={update.isPending}
        className="w-full rounded-xl bg-primary py-3 text-xs font-bold uppercase tracking-wider text-primary-foreground flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {update.isPending && <Loader2 className="size-4 animate-spin" />}
        Save location
      </button>
    </div>
  );
}

function Stat({ label, value, tint = "text-foreground" }: { label: string; value: string; tint?: string }) {
  return (
    <div className="rounded-lg bg-surface/80 p-2.5 text-center ring-1 ring-border">
      <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display text-base font-semibold ${tint}`}>{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function Pref({ icon: Icon, label, sub }: { icon: React.ElementType; label: string; sub: string }) {
  return (
    <div className="rounded-xl bg-surface ring-1 ring-border p-3 flex items-center gap-3">
      <div className="size-8 rounded-lg bg-background grid place-items-center text-primary">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold truncate">{label}</p>
        <p className="text-[10px] text-muted-foreground">{sub}</p>
      </div>
    </div>
  );
}

function Action({
  icon: Icon,
  label,
  danger = false,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  danger?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 rounded-xl bg-surface ring-1 ring-border px-4 py-3 cursor-pointer hover:ring-primary/40 transition-all text-left ${
        danger ? "text-destructive" : ""
      }`}
    >
      <Icon className="size-4" />
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}

function EditProfile({
  initial,
  onDone,
}: {
  initial: { username: string; display_name: string; avatar_url: string };
  onDone: () => void;
}) {
  const update = useUpdateProfile();
  const [username, setUsername] = useState(initial.username);
  const [displayName, setDisplayName] = useState(initial.display_name);
  const [avatar, setAvatar] = useState(initial.avatar_url);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const u = username.trim();
    if (u.length < 2 || !/^[a-zA-Z0-9_-]+$/.test(u)) {
      toast.error("Username: 2+ characters, letters, numbers, _ and - only");
      return;
    }
    try {
      await update.mutateAsync({
        username: u,
        display_name: displayName.trim() || u,
        avatar_url: avatar.trim() || null,
      });
      toast.success("Profile updated");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save profile");
    }
  };

  return (
    <form onSubmit={save} className="rounded-xl bg-surface ring-1 ring-border p-4 space-y-3 animate-fade-in-up">
      <EditField label="Username" value={username} onChange={setUsername} placeholder="viperx" />
      <EditField label="Display name" value={displayName} onChange={setDisplayName} placeholder="Viper X" />
      <EditField label="Avatar image URL" value={avatar} onChange={setAvatar} placeholder="https://…" />
      <button
        type="submit"
        disabled={update.isPending}
        className="w-full rounded-xl bg-primary py-3 text-xs font-bold uppercase tracking-wider text-primary-foreground flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {update.isPending && <Loader2 className="size-4 animate-spin" />}
        Save changes
      </button>
    </form>
  );
}

function IdentityCard({ profile }: { profile: ReturnType<typeof useMyProfile>["data"] }) {
  const save = useSetMyIdentity();
  const [legalName, setLegalName] = useState(profile?.legal_name ?? "");
  const [dob, setDob] = useState(profile?.date_of_birth ?? "");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await save.mutateAsync({ legalName: legalName.trim(), dateOfBirth: dob });
      toast.success("Identity saved — staff will verify your age");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save identity");
    }
  };

  return (
    <div className="rounded-xl bg-surface ring-1 ring-border p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-lg bg-primary/15 grid place-items-center text-primary">
          <BadgeCheck className="size-5" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold">Age verification</p>
          <p className="text-[11px] text-muted-foreground">
            {profile?.age_verified
              ? "Verified — you're confirmed 18 or older."
              : "Real name and date of birth are required for paid play. You must be 18+."}
          </p>
        </div>
        {profile?.age_verified && (
          <span className="rounded-full bg-primary/15 text-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
            Verified
          </span>
        )}
      </div>
      {!profile?.age_verified && (
        <form onSubmit={submit} className="space-y-3">
          <EditField label="Real (legal) name" value={legalName} onChange={setLegalName} placeholder="Jane Doe" />
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Date of birth</span>
            <input
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              className="mt-1 w-full rounded-lg bg-background ring-1 ring-border px-3 py-2 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={save.isPending || !legalName.trim() || !dob}
            className="w-full rounded-xl bg-primary py-3 text-xs font-bold uppercase tracking-wider text-primary-foreground flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {save.isPending && <Loader2 className="size-4 animate-spin" />}
            Submit for verification
          </button>
        </form>
      )}
    </div>
  );
}

function EditField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg bg-background ring-1 ring-border px-3 py-2 text-sm"
      />
    </label>
  );
}
