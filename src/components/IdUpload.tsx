import { useRef, useState } from "react";
import { Camera, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useUploadMyIdDocument } from "@/lib/api";
import { checkMyIdDocument } from "@/lib/id-verify.functions";

export function IdUpload({ hasId }: { hasId: boolean }) {
  const upload = useUploadMyIdDocument();
  const check = useServerFn(checkMyIdDocument);
  const qc = useQueryClient();
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const ref = useRef<HTMLInputElement>(null);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setResult(null);
    try {
      await upload.mutateAsync(file);
      setChecking(true);
      const r = await check();
      setResult({ ok: r.verified, text: r.reason });
      if (r.verified) toast.success("You're 18+ verified");
      qc.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setChecking(false);
    }
  };

  const busy = upload.isPending || checking;

  return (
    <div className="space-y-2">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Photo ID</span>
      <p className="text-[11px] text-muted-foreground">
        Upload a clear photo of your driver's license, state ID or passport. We check that the name and date of birth match your profile. Only SMYD staff can see it.
      </p>
      <input ref={ref} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPick} />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={busy}
        className="w-full rounded-lg bg-background ring-1 ring-border px-3 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : hasId ? <CheckCircle2 className="size-4 text-primary" /> : <Camera className="size-4" />}
        {checking ? "Checking your ID…" : hasId ? "ID uploaded — replace photo" : "Upload photo ID"}
      </button>
      {result && (
        <p className={`text-[11px] font-semibold ${result.ok ? "text-primary" : "text-destructive"}`}>{result.text}</p>
      )}
    </div>
  );
}
