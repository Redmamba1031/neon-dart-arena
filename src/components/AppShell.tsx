import { Link, useLocation } from "@tanstack/react-router";
import { Home, Swords, Trophy, User, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import smydLogo from "@/assets/smyd-logo.png";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [balance] = useState(1240.5);

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-[480px] flex-col border-x border-border/60 relative">
        <Header balance={balance} />
        <main className="flex-1 pb-24">{children}</main>
        <BottomNav />
      </div>
    </div>
  );
}

function Header({ balance }: { balance: number }) {
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border/60 bg-background/80 px-5 py-4 backdrop-blur-xl">
      <Link to="/profile" className="size-10 rounded-full bg-surface ring-1 ring-primary/50 overflow-hidden grid place-items-center font-display font-bold text-primary">
        VX
      </Link>
      <Link to="/" className="flex items-center gap-2">
        <img src={smydLogo} alt="SMYD — Show Me Your Darts" className="h-10 w-auto drop-shadow-[0_0_12px_rgba(220,38,38,0.5)]" />
      </Link>
      <Link
        to="/wallet"
        className="flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 ring-1 ring-border animate-glow-pulse"
      >
        <Wallet className="size-3.5 text-primary" />
        <span className="font-display text-sm font-medium text-primary">
          ${balance.toFixed(2)}
        </span>
      </Link>
    </header>
  );
}

function BottomNav() {
  const { pathname } = useLocation();
  const items = [
    { to: "/", label: "Lobby", icon: Home },
    { to: "/create-match", label: "Play", icon: Swords },
    { to: "/leaderboard", label: "Rank", icon: Trophy },
    { to: "/profile", label: "Profile", icon: User },
  ] as const;

  return (
    <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-[480px] -translate-x-1/2 border-t border-border/60 bg-background/90 px-6 py-3 backdrop-blur-xl">
      <div className="flex items-center justify-around">
        {items.map(({ to, label, icon: Icon }) => {
          const active = pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={`flex flex-col items-center gap-1 transition-colors ${
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="size-5" />
              <span className="text-[9px] font-semibold uppercase tracking-widest">
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
