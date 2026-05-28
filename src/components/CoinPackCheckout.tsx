import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createCoinPackCheckout } from "@/lib/coin-packs.functions";

export function CoinPackCheckout({
  priceId,
  returnUrl,
}: {
  priceId: string;
  returnUrl: string;
}) {
  const fetchClientSecret = async (): Promise<string> => {
    const secret = await createCoinPackCheckout({
      data: { priceId, returnUrl, environment: getStripeEnvironment() },
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
