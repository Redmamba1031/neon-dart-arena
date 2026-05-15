import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createDepositCheckout } from "@/utils/deposits.functions";

export function StripeDepositCheckout({
  amountCents,
  returnUrl,
}: {
  amountCents: number;
  returnUrl: string;
}) {
  const fetchClientSecret = async (): Promise<string> => {
    const secret = await createDepositCheckout({
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
