import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import smydLogo from "@/assets/smyd-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — SMYD" },
      { name: "description", content: "Sign in or create your SMYD darts esports account." },
    ],
  }),
  component: Login,
});

const signInSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(72),
});

const signUpSchema = signInSchema.extend({
  username: z
    .string()
    .trim()
    .min(2, "Username too short")
    .max(32)
    .regex(/^[a-zA-Z0-9_-]+$/, "Letters, numbers, _ and - only"),
});

function Login() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;

    try {
      if (mode === "signup") {
        const parsed = signUpSchema.safeParse({ email, password, username });
        if (!parsed.success) {
          toast.error(parsed.error.issues[0].message);
          return;
        }
        setBusy(true);
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { username: parsed.data.username, display_name: parsed.data.username },
          },
        });
        if (error) throw error;
        toast.success("Check your email to confirm your account.");
        setMode("signin");
      } else {
        const parsed = signInSchema.safeParse({ email, password });
        if (!parsed.success) {
          toast.error(parsed.error.issues[0].message);
          return;
        }
        setBusy(true);
        const { error } = await supabase.auth.signInWithPassword(parsed.data);
        if (error) throw error;
        navigate({ to: "/", replace: true });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
      if (result.redirected) return;
      navigate({ to: "/", replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Google sign-in failed";
      toast.error(message);
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col px-6 py-10">
        <div className="flex flex-col items-center mb-10 animate-fade-in-up">
          <img src={smydLogo} alt="SMYD — Show Me Your Darts" className="w-44 h-auto drop-shadow-[0_0_30px_rgba(220,38,38,0.45)]" />
          <p className="mt-3 text-sm text-muted-foreground tracking-wide">Real-money GranBoard darts</p>
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

        <form onSubmit={handleSubmit} className="space-y-4 animate-fade-in-up">
          {mode === "signup" && (
            <Field
              label="Username"
              placeholder="ViperX"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          )}
          <Field
            label="Email"
            placeholder="you@arena.com"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <Field
            label="Password"
            placeholder="••••••••"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
          />

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-gradient-neon py-4 font-display text-sm font-semibold uppercase tracking-[0.15em] text-background transition-transform active:scale-[0.98] ring-neon disabled:opacity-60"
          >
            {busy ? "Please wait…" : mode === "signin" ? "Enter the Arena" : "Create Account"}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <button
          onClick={handleGoogle}
          disabled={busy}
          className="w-full rounded-xl bg-surface ring-1 ring-border py-3.5 text-xs font-bold uppercase tracking-[0.2em] text-foreground transition-colors hover:bg-surface/80 disabled:opacity-60"
        >
          Continue with Google
        </button>
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
