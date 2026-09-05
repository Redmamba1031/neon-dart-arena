import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Banknote, Coins, Gift, Loader2, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { CoinPackCheckout } from "@/components/CoinPackCheckout";
import { supabase } from "@/integrations/supabase/client";
import { redeemGiftCard } from "@/lib/redemptions.functions";
import {
  useWallet,
  formatMoney,
  useMyWithdrawals,
  useRequestWithdrawal,
} from "@/lib/api";

export const Route = createFileRoute("/shop")({
  head: () => ({
    meta: [
      { title: "Cashier — SMYD" },
      { name: "description", content: "Add funds to your SMYD account, cash out to PayPal, Cash App or Venmo, or redeem gift cards." },
      { property: "og:title", content: "Cashier — SMYD" },
      { property: "og:description", content: "Add funds, cash out, or redeem gift cards on SMYD." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Shop,
});


type Tab = "buy" | "redeem";

function Shop() {
  const [tab, setTab] = useState<Tab>("buy");
  const [checkoutPriceId, setCheckoutPriceId] = useState<string | null>(null);

  return (
    <AppShell>
      <div className="px-5 py-6 space-y-6 animate-fade-in-up">
        <div>
          <h1 className="font-display text-2xl font-bold text-gradient-neon">Shop</h1>
          <p className="text-xs text-muted-foreground mt-1">Top up coins or cash out for gift cards.</p>
        </div>

        <div className="flex rounded-xl bg-surface p-1 ring-1 ring-border">
          {([
            { id: "buy", label: "Buy Coins", icon: Coins },
            { id: "redeem", label: "Redeem", icon: Gift },
          ] as const).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold uppercase tracking-widest transition-all ${
                tab === t.id ? "bg-gradient-neon text-background" : "text-muted-foreground"
              }`}
            >
              <t.icon className="size-3.5" /> {t.label}
            </button>
          ))}
        </div>

        {tab === "buy" ? <BuyCoinsPanel onSelect={setCheckoutPriceId} /> : <RedeemPanel />}
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
    return <div className="text-center text-sm text-muted-foreground py-12">Loading packs…</div>;
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {packs.map((p) => {
        const usd = (Number(p.usd_cents) / 100).toFixed(2);
        const baseCoins = Math.round(Number(p.usd_cents)); // 1 cent = 1 base coin
        const bonus = Number(p.coins_granted) - baseCoins;
        return (
          <button
            key={p.price_id as string}
            onClick={() => onSelect(p.price_id as string)}
            className="relative rounded-2xl bg-surface ring-1 ring-border p-4 text-left transition-all hover:ring-primary/60 hover:scale-[1.02]"
          >
            {bonus > 0 && (
              <span className="absolute top-2 right-2 rounded-full bg-success/20 text-success text-[9px] font-bold uppercase tracking-widest px-2 py-0.5">
                +{Math.round((bonus / baseCoins) * 100)}%
              </span>
            )}
            <Coins className="size-5 text-primary" />
            <p className="mt-2 font-display text-xl font-bold">{Number(p.coins_granted).toLocaleString()}</p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">coins</p>
            <p className="mt-2 text-sm font-semibold">${usd}</p>
          </button>
        );
      })}
    </div>
  );
}

function CheckoutModal({ priceId, onClose }: { priceId: string; onClose: () => void }) {
  const returnUrl = `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`;

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
          <CoinPackCheckout priceId={priceId} returnUrl={returnUrl} />
        </div>
      </div>
    </div>
  );
}

// ---------- Redeem ----------

function useGiftOptions() {
  return useQuery({
    queryKey: ["gift-card-options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gift_card_options")
        .select("*")
        .eq("active", true)
        .order("display_order");
      if (error) throw error;
      return data ?? [];
    },
  });
}

function useRedemptions() {
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase
      .channel("redemptions")
      .on("postgres_changes", { event: "*", schema: "public", table: "gift_card_redemptions" }, () => {
        qc.invalidateQueries({ queryKey: ["redemptions"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  return useQuery({
    queryKey: ["redemptions"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("gift_card_redemptions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });
}

function RedeemPanel() {
  const { data: options = [] } = useGiftOptions();
  const { data: wallet } = useWallet();
  const { data: history = [] } = useRedemptions();
  const qc = useQueryClient();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");

  const balance = Number(wallet?.balance_cents ?? 0);
  const selected = options.find((o) => o.id === selectedId) || null;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Pick a gift card");
      return redeemGiftCard({
        data: {
          optionId: selected.id as string,
          deliveryEmail: email.trim(),
          recipientName: recipientName.trim() || undefined,
        },
      });
    },
    onSuccess: () => {
      toast.success("Gift card sent! Check your email.");
      setSelectedId(null);
      setEmail("");
      setRecipientName("");
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["redemptions"] });
    },
    onError: (e: Error) => {
      toast.error(e.message);
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-surface ring-1 ring-border p-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Available</p>
        <p className="mt-1 font-display text-2xl font-bold text-gradient-neon">{formatCoins(balance)}</p>
        <p className="mt-1 text-[10px] text-muted-foreground">Rate: 150 coins = $1 in gift card value</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {options.map((o) => {
          const affordable = balance >= Number(o.coins_cost);
          const active = selectedId === o.id;
          return (
            <button
              key={o.id as string}
              disabled={!affordable}
              onClick={() => setSelectedId(o.id as string)}
              className={`rounded-2xl p-4 text-left transition-all ring-1 ${
                active ? "bg-primary/10 ring-primary" : "bg-surface ring-border"
              } ${!affordable && "opacity-40 cursor-not-allowed"}`}
            >
              <Gift className="size-5 text-primary" />
              <p className="mt-2 font-display text-xl font-bold">${Number(o.denomination_usd_cents) / 100}</p>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Amazon</p>
              <p className="mt-2 text-xs font-semibold text-primary">
                {Number(o.coins_cost).toLocaleString()} coins
              </p>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="space-y-3 rounded-xl bg-surface ring-1 ring-border p-4 animate-fade-in-up">
          <Field
            label="Delivery email"
            type="email"
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Field
            label="Recipient name (optional)"
            placeholder="Your name"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
          />
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !email}
            className="w-full rounded-xl bg-gradient-neon py-3.5 font-display text-sm font-bold uppercase tracking-[0.15em] text-background disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            Redeem for ${Number(selected.denomination_usd_cents) / 100} Amazon
          </button>
        </div>
      )}

      <div>
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Redemption history
        </h3>
        {history.length === 0 ? (
          <div className="rounded-xl bg-surface ring-1 ring-border p-6 text-center text-sm text-muted-foreground">
            No redemptions yet.
          </div>
        ) : (
          <div className="rounded-xl bg-surface ring-1 ring-border divide-y divide-border/60">
            {history.map((r) => (
              <div key={r.id as string} className="flex items-center gap-3 px-4 py-3">
                <Gift className="size-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    ${Number(r.denomination_usd_cents) / 100} Amazon → {r.delivery_email as string}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {String(r.status)} • {new Date(r.created_at as string).toLocaleDateString()}
                  </p>
                </div>
                <span className="text-xs font-semibold text-muted-foreground">
                  −{Number(r.coins_spent).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
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
        className="mt-1.5 w-full rounded-lg bg-background border border-border px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/60"
      />
    </label>
  );
}
