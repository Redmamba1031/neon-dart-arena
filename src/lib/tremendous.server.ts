// Tremendous client. Sandbox keys (starting with TEST_) hit testflight,
// production keys hit the live API. Amazon US gift cards only for now.

const AMAZON_PRODUCT_ID = "OKMHM2X2OHYV"; // Amazon.com US (Tremendous catalog)

function getApiBase(apiKey: string): string {
  return apiKey.startsWith("TEST_")
    ? "https://testflight.tremendous.com/api/v2"
    : "https://api.tremendous.com/api/v2";
}

export interface TremendousOrderResult {
  orderId: string;
  rewardId: string;
}

export async function createGiftCardOrder(args: {
  redemptionId: string;
  amountUsdCents: number;
  recipientEmail: string;
  recipientName?: string;
}): Promise<TremendousOrderResult> {
  const apiKey = process.env.TREMENDOUS_API_KEY;
  const fundingSource = process.env.TREMENDOUS_FUNDING_SOURCE_ID;
  if (!apiKey) throw new Error("TREMENDOUS_API_KEY is not configured");
  if (!fundingSource) throw new Error("TREMENDOUS_FUNDING_SOURCE_ID is not configured");

  const res = await fetch(`${getApiBase(apiKey)}/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      external_id: redemptionExternalId(args.redemptionId),
      payment: { funding_source_id: fundingSource },
      reward: {
        value: { denomination: args.amountUsdCents / 100, currency_code: "USD" },
        delivery: { method: "EMAIL" },
        recipient: {
          name: args.recipientName || "SMYD Player",
          email: args.recipientEmail,
        },
        products: [AMAZON_PRODUCT_ID],
      },
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.errors?.message || json?.message || `Tremendous ${res.status}`;
    throw new Error(msg);
  }
  const order = json.order;
  const reward = order?.rewards?.[0];
  if (!order?.id || !reward?.id) throw new Error("Tremendous returned malformed order");
  return { orderId: order.id, rewardId: reward.id };
}

function redemptionExternalId(id: string): string {
  return `smyd_redemption_${id}`;
}
