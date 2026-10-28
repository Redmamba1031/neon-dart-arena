import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Truck, MapPin, Package, Mail } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import jerseyFlat from "@/assets/jersey-neon-flat.jpg";

export const Route = createFileRoute("/shipping")({
  head: () => ({
    meta: [
      { title: "Jersey Shipping — SMYD" },
      { name: "description", content: "Shipping information for SMYD custom dart jerseys to the United States, United Kingdom, Ireland and Sweden." },
      { property: "og:title", content: "Jersey Shipping — SMYD" },
      { property: "og:description", content: "Delivery destinations, shipping address details and support for SMYD custom jersey orders." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://smyd.online/shipping" }],
  }),
  component: Shipping,
});

function Shipping() {
  return (
    <AppShell>
      <div className="space-y-6 px-5 py-6 animate-fade-in-up">
        <Button asChild variant="ghost" size="sm" className="px-0">
          <Link to="/"><ArrowLeft />Lobby</Link>
        </Button>
        <header>
          <Truck className="mb-3 size-7 text-primary" />
          <h1 className="font-display text-2xl font-bold text-gradient-neon">Jersey Shipping</h1>
          <p className="mt-2 text-sm text-muted-foreground">SMYD custom jerseys · $60 USD each</p>
        </header>
        <img src={jerseyFlat} alt="SMYD Neon Voltage jersey front and back" width={1264} height={848} className="w-full rounded-lg" />
        <section className="space-y-3 border-b border-border pb-6">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold"><MapPin className="size-5 text-primary" />Destinations</h2>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
            <li>United States</li><li>United Kingdom</li><li>Ireland</li><li>Sweden</li>
          </ul>
        </section>
        <section className="space-y-3 border-b border-border pb-6">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold"><Package className="size-5 text-accent" />Your delivery address</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">Your shipping address is collected during payment. Include your recipient name, street address, apartment or unit, city, postal code and country.</p>
          <p className="text-sm leading-relaxed text-muted-foreground">Production and delivery times, carriers and shipping rates have not yet been confirmed. Contact SMYD before ordering for a delivery estimate and any additional shipping costs.</p>
        </section>
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold"><Mail className="size-5 text-primary" />Order support</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">For an address correction or shipping update, email support with your order details. Never send payment card details by email.</p>
          <Button asChild variant="outline" className="w-full">
            <a href="mailto:support@smyd.online?subject=Jersey%20shipping%20question"><Mail />support@smyd.online</a>
          </Button>
        </section>
      </div>
    </AppShell>
  );
}