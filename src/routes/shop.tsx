import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Banknote, Coins, Loader2, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { CoinPackCheckout } from "@/components/CoinPackCheckout";
import { supabase } from "@/integrations/supabase/client";
import {
  useWallet,
  formatMoney,
  useMyWithdrawals,
  useRequestWithdrawal,
  usePayoutHelp,
} from "@/lib/api";
import { payoutState, type TrackedPayout } from "@/lib/payoutStatus";
import { useServerFn } from "@tanstack/react-start";
import { createPaypalDeposit } from "@/lib/paypal-deposit.functions";
import { createCustomDepositCheckout } from "@/lib/coin-packs.functions";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";

export const Route = createFileRoute("/shop")({
  head: () => ({
    meta: [
      { title: "Cashier — SMYD" },
      { name: "description", content: "Add funds to your SMYD account or cash out to PayPal or Venmo." },
      { property: "og:title", content: "Cashier — SMYD" },
      { property: "og:description", content: "Add funds or cash out on SMYD." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Shop,
});


type Tab = "buy" | "cashout";

function Shop() {
  const [tab, setTab] = useState<Tab>("buy");
  const [checkoutPriceId, setCheckoutPriceId] = useState<string | null>(null);

  return (
    <AppShell>
      <div className="px-5 py-6 space-y-6 animate-fade-in-up">
        <div>
          <h1 className="font-display text-2xl font-bold text-gradient-neon">Cashier</h1>
          <p className="text-xs text-muted-foreground mt-1">Add funds or cash out.</p>
        </div>

        <div className="flex rounded-xl bg-surface p-1 ring-1 ring-border">
          {([
            { id: "buy", label: "Add Funds", icon: Coins },
            { id: "cashout", label: "Cash Out", icon: Banknote },
          ] as const).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-[10px] font-bold uppercase tracking-widest transition-all ${
                tab === t.id ? "bg-gradient-neon text-background" : "text-muted-foreground"
              }`}
            >
              <t.icon className="size-3.5" /> {t.label}
            </button>
          ))}

        </div>

        {tab === "buy" ? <BuyCoinsPanel onSelect={setCheckoutPriceId} /> : <CashOutPanel />}

      </div>

      {checkoutPriceId && (
        <CheckoutModal priceId={checkoutPriceId} onClose={() => setCheckoutPriceId(null)} />
      )}
    </AppShell>
  );
}

// ---------- Buy ----------

function useCoinPacks() {
  return useQuery({
    queryKey: ["coin-packs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coin_packs")
        .select("*")
        .eq("active", true)
        .order("display_order");
      if (error) throw error;
      return data ?? [];
    },
  });
}

function BuyCoinsPanel({ onSelect }: { onSelect: (priceId: string) => void }) {
  const { data: packs = [], isLoading } = useCoinPacks();

  if (isLoading) {
    return <div className="text-center text-sm text-muted-foreground py-12">Loading amounts…</div>;
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {packs.map((p) => (
          <button
            key={p.price_id as string}
            onClick={() => onSelect(p.price_id as string)}
            className="relative rounded-2xl bg-surface ring-1 ring-border p-4 text-left transition-all hover:ring-primary/60 hover:scale-[1.02]"
          >
            <Coins className="size-5 text-primary" />
            <p className="mt-2 font-display text-xl font-bold">{formatMoney(Number(p.coins_granted))}</p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">added to your account</p>
            <p className="mt-2 text-sm font-semibold">{formatMoney(Number(p.usd_cents))}</p>
          </button>
        ))}
        <button
          onClick={() => onSelect("custom")}
          className="relative rounded-2xl bg-surface ring-1 ring-dashed ring-primary/50 p-4 text-left transition-all hover:ring-primary hover:scale-[1.02]"
        >
          <Coins className="size-5 text-accent" />
          <p className="mt-2 font-display text-xl font-bold">Custom</p>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">any amount</p>
          <p className="mt-2 text-sm font-semibold">$5 – $500</p>
        </button>
      </div>
      <p className="text-[10px] text-muted-foreground text-center">
        You get exactly what you pay — $25 in, $25 on your account.
      </p>
    </div>
  );
}


function CheckoutModal({ priceId, onClose }: { priceId: string; onClose: () => void }) {
  const returnUrl = `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`;
  const isCustom = priceId === "custom";
  const [step, setStep] = useState<"amount" | "choose" | "card">(isCustom ? "amount" : "choose");
  const [amountInput, setAmountInput] = useState("");
  const [amountCents, setAmountCents] = useState<number | null>(null);
  const [paypalBusy, setPaypalBusy] = useState(false);
  const startPaypal = useServerFn(createPaypalDeposit);

  const parsedCents = Math.round(Number(amountInput) * 100);
  const amountValid = Number.isFinite(parsedCents) && parsedCents >= 500 && parsedCents <= 50_000;

  const payWithPaypal = async (cents: number | null) => {
    setPaypalBusy(true);
    try {
      const r = await startPaypal({
        data: { priceId, origin: window.location.origin, ...(cents ? { amountCents: cents } : {}) },
      });
      if ("error" in r && r.error) throw new Error(r.error);
      window.location.href = (r as { url: string }).url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "PayPal checkout failed");
      setPaypalBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-4">
      <div className="w-full max-w-[480px] bg-background rounded-2xl ring-1 ring-border my-8">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-display text-lg font-bold">Checkout</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface">
            <X className="size-5" />
          </button>
        </div>
        <div className="p-2">
          {step === "amount" ? (
            <div className="space-y-3 p-3">
              <p className="text-xs text-muted-foreground">How much do you want to add? ($5 – $500)</p>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-muted-foreground">$</span>
                <input
                  type="number"
                  min={5}
                  max={500}
                  step="0.01"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  placeholder="25.00"
                  className="flex-1 rounded-lg bg-surface border border-border px-4 py-3 text-lg font-bold text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/60"
                />
              </div>
              {amountInput && !amountValid && (
                <p className="text-xs text-destructive">Enter an amount between $5 and $500.</p>
              )}
              <button
                onClick={() => { setAmountCents(parsedCents); setStep("choose"); }}
                disabled={!amountValid}
                className="w-full rounded-xl bg-gradient-neon py-3 font-display font-bold text-background disabled:opacity-40"
              >
                Continue
              </button>
            </div>
          ) : step === "choose" ? (
            <div className="space-y-3 p-3">
              <p className="text-xs text-muted-foreground">
                How do you want to pay{amountCents ? ` ${formatMoney(amountCents)}` : ""}?
              </p>
              <button
                onClick={() => setStep("card")}
                className="w-full rounded-xl bg-surface ring-1 ring-border p-4 text-left font-semibold hover:ring-primary/60"
              >
                Card / Apple Pay / Google Pay
              </button>
              <button
                onClick={() => payWithPaypal(amountCents)}
                disabled={paypalBusy}
                className="w-full rounded-xl bg-surface ring-1 ring-border p-4 text-left font-semibold hover:ring-primary/60 flex items-center gap-2 disabled:opacity-60"
              >
                {paypalBusy && <Loader2 className="size-4 animate-spin" />} PayPal
              </button>
            </div>
          ) : amountCents ? (
            <CustomAmountCheckout amountCents={amountCents} returnUrl={returnUrl} />
          ) : (
            <CoinPackCheckout priceId={priceId} returnUrl={returnUrl} />
          )}
        </div>
      </div>
    </div>
  );
}

function CustomAmountCheckout({ amountCents, returnUrl }: { amountCents: number; returnUrl: string }) {
  const fetchClientSecret = async (): Promise<string> => {
    const secret = await createCustomDepositCheckout({
      data: { amountCents, returnUrl, environment: getStripeEnvironment() },
    });
    if (!secret) throw new Error("No client secret returned");
    return secret;
  };

  return (
    <div id="checkout">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}


function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
      <input
        {...props}
        className="mt-1.5 w-full rounded-lg bg-background border border-border px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/60"
      />
    </label>
  );
}

// ---------- Cash out ----------

const METHODS = [
  { id: "paypal", label: "PayPal", hint: "PayPal email" },
  { id: "venmo", label: "Venmo", hint: "Venmo phone number" },
] as const;

function CashOutPanel() {
  const { data: wallet } = useWallet();
  const { data: history = [] } = useMyWithdrawals();
  const request = useRequestWithdrawal();

  const [method, setMethod] = useState<(typeof METHODS)[number]["id"]>("paypal");
  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState(5);

  const balance = Number(wallet?.balance_cents ?? 0);
  const cents = Math.round(amount * 100);
  const tooMuch = cents > balance;
  const active = METHODS.find((m) => m.id === method)!;
  const destinationOk = destination.trim().length >= 3;

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-surface ring-1 ring-border p-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Available to cash out</p>
        <p className="mt-1 font-display text-2xl font-bold text-gradient-neon">{formatMoney(balance)}</p>
        <p className="mt-1 text-[10px] text-muted-foreground">
          $5.00 minimum. Every cash out is held 72 hours for fraud review, then PayPal and Venmo
          payouts send automatically.
        </p>
      </div>

      <div className="space-y-3 rounded-xl bg-surface ring-1 ring-border p-4">
        <div className="grid grid-cols-2 gap-2">
          {METHODS.map((m) => (
            <button
              key={m.id}
              onClick={() => setMethod(m.id)}
              className={`rounded-lg py-2 text-[10px] font-bold uppercase tracking-widest ring-1 transition-all ${
                method === m.id ? "bg-primary/10 ring-primary text-primary" : "ring-border text-muted-foreground"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <Field
          label={active.label + " destination"}
          placeholder={active.hint}
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
        />
        <Field
          label="Amount (USD)"
          type="number"
          min={5}
          step={1}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
        />

        {tooMuch && (
          <p className="text-[10px] text-destructive">That is more than your balance.</p>
        )}

        <button
          onClick={() =>
            request.mutate(
              { amountCents: cents, method, destination: destination.trim() },
              {
                onSuccess: () => {
                  toast.success("Cash out requested — it releases after the 72 hour review hold.");
                  setDestination("");
                  setAmount(5);
                },
                onError: (e: Error) => toast.error(e.message),
              },
            )
          }
          disabled={request.isPending || tooMuch || cents < 500 || !destinationOk}
          className="w-full rounded-xl bg-gradient-neon py-3.5 font-display text-sm font-bold uppercase tracking-[0.15em] text-background disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {request.isPending && <Loader2 className="size-4 animate-spin" />}
          Request {formatMoney(cents)}
        </button>
      </div>

      <PayoutTracker history={history} />
      <PayoutHelp />
    </div>
  );
}

// ---------- Payout status tracker ----------

// ---------- Payout tracker ----------

function PayoutTracker({ history }: { history: TrackedPayout[] }) {
  return (
    <div>
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Payout status</h3>
      {history.length === 0 ? (
        <div className="rounded-xl bg-surface ring-1 ring-border p-6 text-center text-sm text-muted-foreground">
          No payouts yet.
        </div>
      ) : (
        <div className="rounded-xl bg-surface ring-1 ring-border divide-y divide-border/60">
          {history.map((r) => {
            const s = payoutState(r);
            return (
              <div key={r.id} className="flex items-start gap-3 px-4 py-3">
                <Banknote className="mt-0.5 size-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0 space-y-0.5">
                  <p className="text-sm font-medium truncate">
                    {formatMoney(Number(r.amount_cents))} → {r.destination}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {r.method} • {new Date(r.created_at).toLocaleDateString()}
                  </p>
                  <p className={`text-[11px] font-semibold ${s.tone}`}>{s.label}</p>
                  <p className="text-[11px] text-muted-foreground">{s.detail}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------- AI payout help ----------

function PayoutHelp() {
  const help = usePayoutHelp();
  const [question, setQuestion] = useState("");
  const answer = help.data;

  return (
    <div className="rounded-xl bg-surface ring-1 ring-border p-4 space-y-3">
      <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Trouble with a payout?
      </h3>
      <textarea
        rows={3}
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Describe what happened — e.g. my Venmo cash out has not arrived after 3 days"
        className="w-full rounded-lg bg-background border border-border px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/60"
      />
      <button
        onClick={() =>
          help.mutate(question.trim(), { onError: (e: Error) => toast.error(e.message) })
        }
        disabled={help.isPending || question.trim().length < 5}
        className="w-full rounded-xl bg-gradient-neon py-3 font-display text-sm font-bold uppercase tracking-[0.15em] text-background disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {help.isPending && <Loader2 className="size-4 animate-spin" />}
        Get help
      </button>

      {answer?.error && <p className="text-[11px] text-destructive">{answer.error}</p>}
      {answer && !answer.error && (
        <div className="space-y-2 rounded-lg bg-background p-3 ring-1 ring-border">
          <p className="text-sm text-foreground">{answer.cause}</p>
          {answer.steps.length > 0 && (
            <ul className="list-disc space-y-1 pl-4 text-[12px] text-muted-foreground">
              {answer.steps.map((s: string, i: number) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          )}
          {answer.needsStaff && (
            <p className="text-[11px] text-muted-foreground">
              Still stuck? Email redmond1031@gmail.com with the amount and date.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

