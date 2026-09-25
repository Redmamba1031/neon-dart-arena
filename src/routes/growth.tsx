import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Shield } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { formatMoney, useIsStaff } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/growth")({
  head: () => ({
    meta: [
      { title: "Player Growth — SMYD" },
      { name: "description", content: "Staff view of new SMYD sign-ups, first deposits, first-deposit bonus claims and where players come from." },
      { property: "og:title", content: "Player Growth — SMYD" },
      { property: "og:description", content: "New sign-ups, first deposits, bonus claims and player sources." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GrowthPage,
});

type Stats = {
  signups: number; first_deposits: number; bonus_claims: number; bonus_cents: number;
  sources: { source: string; signups: number; deposited: number }[];
  daily: { day: string; signups: number; first_deposits: number; bonuses: number }[];
};

const card = "rounded-xl bg-surface ring-1 ring-border p-4 space-y-3";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-background ring-1 ring-border px-3 py-2">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="font-display text-lg font-bold">{value}</p>
    </div>
  );
}

function GrowthPage() {
  const [days, setDays] = useState(30);
  const { data: role, isLoading } = useIsStaff();
  const { data, isLoading: statsLoading } = useQuery({
    queryKey: ["growth", days],
    enabled: !!role?.staff,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_growth_stats" as never, { _days: days } as never);
      if (error) throw error;
      return data as unknown as Stats;
    },
  });

  if (isLoading) return <AppShell><div className="p-10 text-center text-sm text-muted-foreground">Checking access…</div></AppShell>;
  if (!role?.staff) {
    return (
      <AppShell>
        <div className="px-5 py-10 space-y-3 text-center">
          <Shield className="mx-auto size-8 text-muted-foreground" />
          <h1 className="font-display text-xl font-bold">Staff only</h1>
        </div>
      </AppShell>
    );
  }

  const conv = data && data.signups ? Math.round((data.first_deposits / data.signups) * 100) : 0;

  return (
    <AppShell>
      <div className="px-5 py-6 space-y-5 animate-fade-in-up">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold">Player growth</h1>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-lg bg-background ring-1 ring-border px-2 py-1 text-sm">
            <option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option>
          </select>
        </div>
        {statsLoading || !data ? <p className="text-sm text-muted-foreground">Loading…</p> : (
          <>
            <section className="grid grid-cols-2 gap-3">
              <Stat label="New sign-ups" value={data.signups} />
              <Stat label="First deposits" value={data.first_deposits} />
              <Stat label="Bonus claims" value={data.bonus_claims} />
              <Stat label="Bonus paid" value={formatMoney(data.bonus_cents)} />
              <Stat label="Sign-up → deposit" value={`${conv}%`} />
            </section>
            <section className={card}>
              <h2 className="font-semibold">How players found SMYD</h2>
              {data.sources.length === 0 ? <p className="text-sm text-muted-foreground">No sign-ups yet.</p> : (
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-muted-foreground"><th>Source</th><th>Sign-ups</th><th>Deposited</th></tr></thead>
                  <tbody>{data.sources.map((s) => (
                    <tr key={s.source} className="border-t border-border"><td className="py-1">{s.source}</td><td>{s.signups}</td><td>{s.deposited}</td></tr>
                  ))}</tbody>
                </table>
              )}
              <p className="text-xs text-muted-foreground">Sources are tracked for new sign-ups from today on; older players show as "unknown".</p>
            </section>
            <section className={card}>
              <h2 className="font-semibold">Day by day</h2>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-muted-foreground"><th>Day</th><th>Sign-ups</th><th>1st deposits</th><th>Bonuses</th></tr></thead>
                <tbody>{data.daily.filter((d) => d.signups || d.first_deposits || d.bonuses).map((d) => (
                  <tr key={d.day} className="border-t border-border"><td className="py-1">{d.day}</td><td>{d.signups}</td><td>{d.first_deposits}</td><td>{d.bonuses}</td></tr>
                ))}</tbody>
              </table>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
