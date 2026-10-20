import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Shirt, Sparkles, ChevronDown } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createJerseyCheckout } from "@/lib/apparel.functions";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { Button } from "@/components/ui/button";
import jerseyNeon from "@/assets/jersey-neon.png";
import jerseyRed from "@/assets/jersey-red.png";
import jerseyWhite from "@/assets/jersey-white.png";
import jerseyNeonFlat from "@/assets/jersey-neon-flat.jpg";
import jerseyRedFlat from "@/assets/jersey-red-flat.jpg";
import jerseyWhiteFlat from "@/assets/jersey-white-flat.jpg";

export const Route = createFileRoute("/apparel")({
  head: () => ({
    meta: [
      { title: "Custom Apparel — SMYD" },
      {
        name: "description",
        content:
          "Official SMYD dart jerseys with SMYD.online branding — pick a design or customize your own with your name and number.",
      },
      { property: "og:title", content: "Custom Apparel — SMYD" },
      {
        property: "og:description",
        content: "Official SMYD dart jerseys — pick a design or customize your own with your name and number.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://smyd.online/apparel" }],
  }),
  component: Apparel,
});

const DESIGNS = [
  {
    id: "neon",
    name: "Neon Voltage",
    img: jerseyNeon,
    flat: jerseyNeonFlat,
    blurb: "Black performance fabric with electric blue and purple neon flight pattern.",
    tint: "text-primary",
  },
  {
    id: "crimson",
    name: "Crimson Flame",
    img: jerseyRed,
    flat: jerseyRedFlat,
    blurb: "Black and crimson with SMYD across the chest in white and red.",
    tint: "text-destructive",
  },
  {
    id: "tour",
    name: "Tour White",
    img: jerseyWhite,
    flat: jerseyWhiteFlat,
    blurb: "White and graphite with neon green piping — clean tournament look.",
    tint: "text-accent",
  },
] as const;

const SIZES = ["S", "M", "L", "XL", "2XL"] as const;

function Apparel() {
  return (
    <AppShell>
      <div className="px-5 py-6 space-y-6 animate-fade-in-up">
        <div>
          <h1 className="font-display text-2xl font-bold text-gradient-neon">Custom Apparel</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Official SMYD dart jerseys — $60 USD each.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {DESIGNS.map((d) => (
            <div
              key={d.id}
              className="rounded-2xl bg-surface ring-1 ring-border overflow-hidden"
            >
              <img
                src={d.flat}
                alt={`SMYD ${d.name} jersey — flat 2D front view on the left and back view on the right`}
                loading="lazy"
                width={1264}
                height={848}
                className="w-full aspect-[1264/848] object-contain"
              />
              <div className="flex-1 min-w-0 p-4 flex flex-col">
                <div className="flex items-center gap-2">
                  <Shirt className={`size-4 ${d.tint}`} />
                  <h2 className="font-display text-base font-bold truncate">{d.name}</h2>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground leading-snug">{d.blurb}</p>
                <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Sizes {SIZES.join(" · ")}
                </p>
                <p className="mt-auto pt-2 text-[10px] text-muted-foreground/80">
                  SMYD.ONLINE printed on every jersey.
                </p>
              </div>
            </div>
          ))}
        </div>

        <JerseyCustomizer />
      </div>
    </AppShell>
  );
}

function JerseyCustomizer() {
  const [design, setDesign] = useState<(typeof DESIGNS)[number]["id"]>("neon");
  const [size, setSize] = useState<(typeof SIZES)[number]>("M");
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");

  const activeDesign = DESIGNS.find((d) => d.id === design) ?? DESIGNS[0];
  const nameOk = /^[A-Za-z .'-]{2,14}$/.test(name.trim());
  const numberOk = number === "" || /^([0-9]|[0-9]{2})$/.test(number) && Number(number) <= 99;
  const ready = nameOk && numberOk;

  const [qty, setQty] = useState(1);
  const [checkout, setCheckout] = useState(false);
  const fetchClientSecret = async () => {
    const r = await createJerseyCheckout({
      data: { design, size, name: name.trim(), number, quantity: qty,
        returnUrl: `${window.location.origin}/apparel?order=done`, environment: getStripeEnvironment() },
    });
    if ("error" in r) throw new Error(r.error);
    return r.clientSecret;
  };
  const done = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("order") === "done";

  return (
    <div className="rounded-2xl bg-surface ring-1 ring-primary/40 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-primary" />
        <h2 className="font-display text-lg font-bold">Customize Your Jersey</h2>
      </div>

      <figure className="overflow-hidden rounded-lg">
        <img
          src={activeDesign.flat}
          alt={`${activeDesign.name} — 2D front and back jersey views`}
          width={1264}
          height={848}
          className="w-full aspect-[1264/848] object-contain"
        />
        <figcaption className="grid grid-cols-2 py-2 text-center text-xs font-semibold text-muted-foreground">
          <span>Front</span>
          <span>Back</span>
        </figcaption>
      </figure>

      <fieldset disabled={checkout} className="contents disabled:[&_*]:cursor-not-allowed">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Design</p>
        <div className="grid grid-cols-3 gap-2">
          {DESIGNS.map((d) => (
            <button
              key={d.id}
              onClick={() => setDesign(d.id)}
              className={`rounded-lg overflow-hidden ring-1 transition-all ${
                design === d.id ? "ring-primary scale-[1.02]" : "ring-border opacity-80 hover:opacity-100"
              }`}
            >
              <img src={d.img} alt={d.name} loading="lazy" width={896} height={1152} className="w-full aspect-[4/5] object-cover object-top" />
              <p className="py-1 text-[9px] font-bold uppercase tracking-widest text-center">{d.name}</p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Size</p>
        <div className="flex gap-2">
          {SIZES.map((s) => (
            <button
              key={s}
              onClick={() => setSize(s)}
              className={`flex-1 rounded-lg py-2 text-[10px] font-bold uppercase tracking-widest ring-1 transition-all ${
                size === s ? "bg-primary/10 ring-primary text-primary" : "ring-border text-muted-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_88px] gap-2">
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Jersey name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="YOUR NAME"
            maxLength={14}
            className="mt-1.5 w-full rounded-lg bg-background border border-border px-3 py-2.5 text-sm font-bold uppercase tracking-wider placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/60"
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Number</span>
          <input
            value={number}
            onChange={(e) => setNumber(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))}
            inputMode="numeric"
            placeholder="00"
            className="mt-1.5 w-full rounded-lg bg-background border border-border px-3 py-2.5 text-sm font-bold text-center placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/60"
          />
        </label>
      </div>
      {name.trim() !== "" && !nameOk && (
        <p className="text-[10px] text-destructive">Name: 2–14 letters, no numbers or symbols.</p>
      )}
      {!numberOk && <p className="text-[10px] text-destructive">Number: 0–99.</p>}
      </fieldset>

      <div className="rounded-lg bg-background ring-1 ring-border p-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Your jersey</p>
        <p className="mt-1 text-sm font-semibold">
          {activeDesign.name} · {size}
          {nameOk && ` · ${name.trim().toUpperCase()}`}
          {number !== "" && numberOk && ` · #${number}`}
        </p>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Quantity</span>
        <div className="flex items-center gap-3">
          <button onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={checkout} className="size-8 rounded-lg ring-1 ring-border">−</button>
          <span className="font-bold w-4 text-center">{qty}</span>
          <button onClick={() => setQty((q) => Math.min(10, q + 1))} disabled={checkout} className="size-8 rounded-lg ring-1 ring-border">+</button>
        </div>
      </div>
      <p className="text-sm font-bold">Total: ${(60 * qty).toFixed(2)} <span className="text-[10px] font-normal text-muted-foreground">($60 USD per jersey)</span></p>
      {done && <p className="text-xs text-primary font-semibold">Order received! We'll email you when your jersey ships.</p>}
      {checkout ? (
        <div className="rounded-xl overflow-hidden bg-background">
          <button
            type="button"
            onClick={() => setCheckout(false)}
            className="mb-2 w-full rounded-lg py-2 text-[10px] font-bold uppercase tracking-widest ring-1 ring-border text-muted-foreground"
          >
            Edit jersey
          </button>
          <PaymentTestModeBanner />
          <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </div>
      ) : (
        <button
          onClick={() => setCheckout(true)}
          disabled={!ready}
          className="block w-full rounded-xl bg-gradient-neon py-3.5 text-center font-display text-sm font-bold uppercase tracking-[0.15em] text-background disabled:opacity-50"
        >
          Buy Now — ${(60 * qty).toFixed(2)}
        </button>
      )}
      <p className="text-[10px] text-muted-foreground flex items-start gap-1.5">
        <ChevronDown className="size-3 mt-0.5 shrink-0" />
        Pay securely in the app. Sign in required. Ships to the US, UK, Ireland and Sweden — enter your address at checkout.
      </p>
      <Button asChild variant="link" className="h-auto p-0">
        <Link to="/shipping">Shipping information</Link>
      </Button>
    </div>
  );
}
