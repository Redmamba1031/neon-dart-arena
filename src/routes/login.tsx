import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Target } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — SMYD" },
      { name: "description", content: "Sign in or create your SMYD darts esports account." },
    ],
  }),
  component: Login,
});

function Login() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col px-6 py-10">
        <div className="flex flex-col items-center mb-10 animate-fade-in-up">
          <div className="size-14 rounded-2xl bg-gradient-neon grid place-items-center ring-neon mb-4">
            <Target className="size-7 text-background" strokeWidth={2.5} />
          </div>
          <h1 className="font-display text-3xl font-bold uppercase tracking-tight">
            <span className="text-gradient-neon">SMYD</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">Real-money GranBoard darts</p>
        </div>

        <div className="flex rounded-xl bg-surface p-1 ring-1 ring-border mb-6">
          {(["signin", "signup"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 rounded-lg py-2.5 text-xs font-bold uppercase tracking-widest transition-all ${
                mode === m ? "bg-gradient-neon text-background" : "text-muted-foreground"
              }`}
            >
              {m === "signin" ? "Sign In" : "Sign Up"}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); navigate({ to: "/" }); }}
          className="space-y-4 animate-fade-in-up"
        >
          {mode === "signup" && <Field label="Username" placeholder="ViperX" />}
          <Field label="Email" placeholder="you@arena.com" type="email" />
          <Field label="Password" placeholder="••••••••" type="password" />

          <button
            type="submit"
            className="w-full rounded-xl bg-gradient-neon py-4 font-display text-sm font-semibold uppercase tracking-[0.15em] text-background transition-transform active:scale-[0.98] ring-neon"
          >
            {mode === "signin" ? "Enter the Arena" : "Create Account"}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <button className="w-full rounded-xl bg-discord/10 ring-1 ring-discord/30 py-3.5 text-xs font-bold uppercase tracking-[0.2em] text-discord transition-colors hover:bg-discord/20">
          Continue with Discord
        </button>

        <Link to="/" className="mt-auto text-center text-xs text-muted-foreground hover:text-foreground pt-8">
          Skip for now →
        </Link>
      </div>
    </div>
  );
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
      <input
        {...props}
        className="mt-1.5 w-full rounded-lg bg-surface border border-border px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/60"
      />
    </label>
  );
}
