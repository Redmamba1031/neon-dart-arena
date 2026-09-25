export type TrackedPayout = {
  id: string;
  amount_cents: number;
  method: string;
  destination: string;
  status: string;
  created_at: string;
  [key: string]: unknown;
};

export type PayoutState = { label: string; tone: string; detail: string };

export function payoutState(r: TrackedPayout): PayoutState {
  const failure = (r["failure_reason"] as string | null) ?? null;
  const review = Boolean(r["requires_review"]);
  const holdUntil = (r["hold_until"] as string | null) ?? null;
  const onHold = holdUntil ? new Date(holdUntil).getTime() > Date.now() : false;

  if (r.status === "paid") {
    return { label: "Completed", tone: "text-primary", detail: "Sent to your account. Bank transfers can take 1-2 business days to appear." };
  }
  if (r.status === "rejected") {
    return { label: "Returned", tone: "text-destructive", detail: failure ?? "This cash out was cancelled and the money is back in your SMYD balance." };
  }
  if (r.status === "failed") {
    return { label: "Needs attention", tone: "text-destructive", detail: failure ?? "We could not send this one. Check your payout details." };
  }
  if (review) {
    return { label: "Needs attention", tone: "text-destructive", detail: "Waiting on a staff review before it can send." };
  }
  if (r.status === "processing") {
    return { label: "Sending", tone: "text-primary", detail: "On its way now." };
  }
  if (onHold) {
    return {
      label: "Pending",
      tone: "text-muted-foreground",
      detail: `On the 72 hour review hold until ${new Date(holdUntil!).toLocaleString()}.`,
    };
  }
  return { label: "Pending", tone: "text-muted-foreground", detail: "Queued — it sends on the next payout run." };
}
