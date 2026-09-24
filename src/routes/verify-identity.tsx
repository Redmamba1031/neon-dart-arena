import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BadgeCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { useMyProfile, useSetMyIdentity } from "@/lib/api";

export const Route = createFileRoute("/verify-identity")({
  head: () => ({
    meta: [
      { title: "Verify your identity — SMYD" },
      { name: "description", content: "Add your real name and date of birth to play on SMYD." },
      { property: "og:title", content: "Verify your identity — SMYD" },
      { property: "og:description", content: "Add your real name and date of birth to play on SMYD." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VerifyIdentity,
});

function VerifyIdentity() {
  const navigate = useNavigate();
  const { data: profile } = useMyProfile();
  const save = useSetMyIdentity();
  const [legalName, setLegalName] = useState("");
  const [dob, setDob] = useState("");

  useEffect(() => {
    if (profile?.legal_name && profile?.date_of_birth) navigate({ to: "/" });
  }, [profile, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await save.mutateAsync({ legalName: legalName.trim(), dateOfBirth: dob });
      toast.success("Saved — staff will verify your age");
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    }
  };

  return (
    <AppShell>
      <div className="px-5 py-8 space-y-5 animate-fade-in-up">
        <div className="flex items-center gap-3">
          <div className="size-12 rounded-xl bg-primary/15 grid place-items-center text-primary">
            <BadgeCheck className="size-6" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Verify your identity</h1>
            <p className="text-xs text-muted-foreground">Required before you can use SMYD. You must be 18+.</p>
          </div>
        </div>
        <form onSubmit={submit} className="rounded-xl bg-surface ring-1 ring-border p-4 space-y-3">
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Real (legal) name</span>
            <input
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              placeholder="Jane Doe"
              className="mt-1 w-full rounded-lg bg-background ring-1 ring-border px-3 py-2 text-sm"
            />
          </label>
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
            Save and continue
          </button>
        </form>
      </div>
    </AppShell>
  );
}
