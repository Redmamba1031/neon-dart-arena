import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Mail, Shield, FileText, Scale, RefreshCcw } from "lucide-react";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "Contact & Support — SMYD" },
      { name: "description", content: "Get help with your SMYD account, matches, payouts, and disputes." },
      { property: "og:title", content: "Contact & Support — SMYD" },
      { property: "og:description", content: "Get help with your SMYD account, matches, payouts, and disputes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SupportPage,
});

const DOCS = [
  { to: "/rules", label: "Competition Rules", desc: "Reporting windows, camera rule, disputes, bans", icon: Shield },
  { to: "/terms", label: "Terms of Service", desc: "Eligibility, accounts, funds, fair play", icon: Scale },
  { to: "/privacy", label: "Privacy Policy", desc: "What we collect and how we use it", icon: FileText },
  { to: "/refunds", label: "Refunds & Cancellations", desc: "Deposits, stakes, gift cards, withdrawals", icon: RefreshCcw },
] as const;

function SupportPage() {
  return (
    <AppShell>
      <div className="space-y-6 px-5 py-6">
        <div>
          <h1 className="font-display text-2xl font-bold">Support</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Need a hand with a match, payout, or your account? We're here.
          </p>
        </div>

        <a
          href="mailto:redmond1031@gmail.com"
          className="flex items-center gap-3 rounded-2xl bg-surface p-5 ring-1 ring-primary/50 transition-colors hover:ring-primary"
        >
          <span className="grid size-11 place-items-center rounded-xl bg-primary/15">
            <Mail className="size-5 text-primary" />
          </span>
          <span>
            <span className="block font-display text-sm font-bold">Email support</span>
            <span className="block text-xs text-muted-foreground">redmond1031@gmail.com — include your username</span>
          </span>
        </a>

        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Help topics</p>
          {DOCS.map(({ to, label, desc, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-3 rounded-xl bg-surface p-4 ring-1 ring-border transition-colors hover:ring-primary/50"
            >
              <Icon className="size-4 shrink-0 text-accent" />
              <span>
                <span className="block text-sm font-semibold">{label}</span>
                <span className="block text-[11px] text-muted-foreground">{desc}</span>
              </span>
            </Link>
          ))}
        </div>

        <div className="rounded-xl bg-surface/60 p-4 text-[11px] leading-relaxed text-muted-foreground ring-1 ring-border">
          <p className="font-semibold text-foreground">Reporting a dispute?</p>
          <p className="mt-1">
            If your match is stuck or your opponent posted a false result, don't post again — the match is
            already flagged for staff review. Email us your match details and any video evidence from your
            camera (board must be visible from more than 8 feet away).
          </p>
        </div>
      </div>
    </AppShell>
  );
}
