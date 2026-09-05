import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import smydLogo from "@/assets/smyd-logo.png";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset Password — SMYD" },
      { name: "description", content: "Choose a new password for your SMYD darts account." },
      { property: "og:title", content: "Reset Password — SMYD" },
      { property: "og:description", content: "Set a new password for your SMYD account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setReady(!!data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setReady(!!s));
    return () => subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return toast.error("Password must be at least 6 characters");
    if (password !== confirm) return toast.error("Passwords don't match");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col px-6 py-10">
        <div className="flex flex-col items-center mb-10 animate-fade-in-up">
          <img src={smydLogo} alt="SMYD — Show Me Your Darts" className="w-36 h-auto" />
          <h1 className="mt-4 font-display text-xl font-bold">Set a new password</h1>
        </div>

        {!ready ? (
          <p className="text-center text-sm text-muted-foreground">
            Open the reset link from your email on this device to set a new password.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">New password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className="mt-1.5 w-full rounded-lg bg-surface border border-border px-4 py-3 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Confirm password</span>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                className="mt-1.5 w-full rounded-lg bg-surface border border-border px-4 py-3 text-sm"
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-gradient-neon py-4 font-display text-sm font-semibold uppercase tracking-[0.15em] text-background disabled:opacity-60"
            >
              {busy ? "Saving…" : "Update password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
