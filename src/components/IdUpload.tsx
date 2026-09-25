import { useRef } from "react";
import { Camera, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useUploadMyIdDocument } from "@/lib/api";

export function IdUpload({ hasId }: { hasId: boolean }) {
  const upload = useUploadMyIdDocument();
  const ref = useRef<HTMLInputElement>(null);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      await upload.mutateAsync(file);
      toast.success("Photo ID uploaded — staff will review it");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    }
  };

  return (
    <div className="space-y-2">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Photo ID</span>
      <p className="text-[11px] text-muted-foreground">
        Upload a clear photo of your driver's license, state ID or passport. Name and date of birth must match. Only SMYD staff can see it.
      </p>
      <input ref={ref} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPick} />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={upload.isPending}
        className="w-full rounded-lg bg-background ring-1 ring-border px-3 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {upload.isPending ? <Loader2 className="size-4 animate-spin" /> : hasId ? <CheckCircle2 className="size-4 text-primary" /> : <Camera className="size-4" />}
        {hasId ? "ID uploaded — replace photo" : "Upload photo ID"}
      </button>
    </div>
  );
}
