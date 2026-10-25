import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Trophy, Flame, MessageSquare, Award, Swords, LayoutDashboard, ShieldAlert } from "lucide-react";
import { useMyProfile } from "@/lib/api";
import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { trackEvent } from "@/lib/analytics";
import { sendMyVerificationReminder } from "@/lib/verify-reminder.functions";
import posterAsset from "@/assets/smyd-500-tournament-poster.png.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SMYD — Online GranBoard Darts Arena" },
      { name: "description", content: "Your online darts arena: 1v1 skill matches in 501 and Cricket, leaderboards and a $500 monthly contest." },
      { property: "og:title", content: "SMYD — Online GranBoard Darts Arena" },
      { property: "og:description", content: "1v1 skill matches in 501 and Cricket, leaderboards and a $500 monthly contest." },
      { property: "og:url", content: "https://smyd.online/" },
    ],
    links: [{ rel: "canonical", href: "https://smyd.online/" }],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data: me } = useMyProfile();
  const sendReminder = useServerFn(sendMyVerificationReminder);

  useEffect(() => {
    if (sessionStorage.getItem("smyd_dv")) return;
    sessionStorage.setItem("smyd_dv", "1");
    trackEvent("dashboard_view", "/");
  }, []);

  // Unverified players get one reminder email per account, triggered by
  // their own visit here. Guarded per session so we don't call it repeatedly.
  useEffect(() => {
    if (!me || me.age_verified) return;
    if (sessionStorage.getItem("smyd_vr")) return;
    sessionStorage.setItem("smyd_vr", "1");
    sendReminder().catch(() => {});
  }, [me, sendReminder]);

  return (
    <AppShell>
      <h1 className="sr-only">SMYD — Your Online Darts Arena</h1>
      {me && !me.age_verified && (
        <section className="px-5 pt-4">
          <Link
            to="/verify-identity"
            className="flex items-center gap-3 rounded-xl bg-primary/10 ring-1 ring-primary/40 p-4 transition-transform active:scale-[0.98]"
          >
            <div className="size-10 rounded-lg bg-primary/15 grid place-items-center text-primary shrink-0">
              <ShieldAlert className="size-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Verify your age &amp; ID</p>
              <p className="text-[11px] text-muted-foreground">
                Required before you can play paid matches. Tap to verify now.
              </p>
            </div>
          </Link>
        </section>
      )}
      <section className="px-5 pt-6 grid grid-cols-2 gap-3 mb-6 animate-fade-in-up">
        <QuickAction to="/matches" icon={Swords} label="1v1 Matches" tint="primary" />
        <QuickAction to="/leaderboard" icon={Award} label="Leaderboard" tint="accent" />
        <QuickAction to="/dashboard" icon={LayoutDashboard} label="My Dashboard" tint="primary" />
        <QuickAction to="/wallet" icon={Trophy} label="Wallet" tint="muted" />
        <QuickAction to="/messages" icon={MessageSquare} label="Messages" tint="primary" />
        <QuickAction to="/monthly-tournament" icon={Trophy} label="$500 Monthly" tint="accent" />
      </section>

      <section className="px-5 mb-6">
        <Link
          to="/monthly-tournament"
          onClick={() => trackEvent("dashboard_view", "/")}
          className="block overflow-hidden rounded-2xl ring-1 ring-primary/40 transition-transform active:scale-[0.98]"
        >
          <img
            src={posterAsset.url}
            alt="SMYD $500 Tournament each month — 16 players drawn for Pro members, $500 prize pool. First tournament Oct. 30, drawing October 28th."
            className="block w-full"
          />
        </Link>
      </section>

      <section className="px-5">
        <div className="rounded-xl bg-surface ring-1 ring-border p-5 flex items-center gap-4">
          <div className="size-10 rounded-lg bg-primary/15 grid place-items-center text-primary">
            <Flame className="size-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">
              {me?.display_name || me?.username || "Player"}
            </p>
            <p className="text-[11px] text-muted-foreground">Welcome back to the arena.</p>
          </div>
        </div>
      </section>
    </AppShell>
  );
}

function QuickAction({
  to, icon: Icon, label, tint,
}: { to: string; icon: React.ElementType; label: string; tint: "primary" | "accent" | "muted" }) {
  const tintClass = tint === "primary" ? "text-primary" : tint === "accent" ? "text-accent" : "text-muted-foreground";
  return (
    <Link
      to={to}
      className="flex h-16 items-center gap-3 rounded-xl bg-surface px-4 ring-1 ring-border transition-transform active:scale-[0.97] hover:ring-primary/30"
    >
      <div className={`size-8 grid place-items-center rounded-lg bg-background ${tintClass}`}>
        <Icon className="size-4" />
      </div>
      <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
    </Link>
  );
}
