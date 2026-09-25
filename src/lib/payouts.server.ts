import { createClient } from "@supabase/supabase-js";
import { createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";

export type PayoutMethod = "paypal" | "venmo" | "bank" | "cashapp";

export type WithdrawalRow = {
  id: string;
  user_id: string;
  amount_cents: number;
  method: string;
  destination: string;
  status: string;
};

let _admin: ReturnType<typeof createClient> | null = null;
export function adminDb(): any {
  if (!_admin) {
    _admin = createClient(
      process.env["SUPABASE_URL"]!,
      process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return _admin;
}

/* ---------------- PayPal (covers PayPal + Venmo) ---------------- */

export function paypalBase() {
  return (process.env["PAYPAL_ENV"] ?? "live") === "sandbox"
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";
}

export function paypalConfigured() {
  return Boolean(process.env["PAYPAL_CLIENT_ID"] && process.env["PAYPAL_CLIENT_SECRET"]);
}

export async function paypalToken(): Promise<string> {
  const id = process.env["PAYPAL_CLIENT_ID"];
  const secret = process.env["PAYPAL_CLIENT_SECRET"];
  if (!id || !secret) throw new Error("PayPal payouts are not configured");
  const res = await fetch(`${paypalBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const json = (await res.json()) as { access_token?: string; error_description?: string };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description ?? "PayPal authentication failed");
  }
  return json.access_token;
}

export async function verifyPaypal(): Promise<{ ok: boolean; error: string | null }> {
  if (!paypalConfigured()) return { ok: false, error: "PayPal credentials are not saved" };
  try {
    await paypalToken();
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: (e as { message?: string })?.message ?? "PayPal authentication failed" };
  }
}

async function sendPaypalPayout(row: WithdrawalRow): Promise<string> {
  const token = await paypalToken();
  const isVenmo = row.method === "venmo";
  const receiver = row.destination.trim();

  const body = {
    sender_batch_header: {
      sender_batch_id: `smyd-${row.id}`,
      email_subject: "Your SMYD cash out",
      email_message: "Your SMYD winnings have been sent.",
    },
    items: [
      {
        recipient_type: isVenmo ? "PHONE" : receiver.includes("@") ? "EMAIL" : "PAYPAL_ID",
        ...(isVenmo ? { recipient_wallet: "VENMO" } : {}),
        amount: { value: (row.amount_cents / 100).toFixed(2), currency: "USD" },
        note: "SMYD cash out",
        sender_item_id: row.id,
        receiver: isVenmo ? receiver.replace(/[^\d+]/g, "") : receiver,
      },
    ],
  };

  const res = await fetch(`${paypalBase()}/v1/payments/payouts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": `smyd-${row.id}`,
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as {
    batch_header?: { payout_batch_id?: string };
    message?: string;
    details?: { issue?: string; description?: string }[];
  };
  if (!res.ok) {
    const detail = json.details?.[0]?.description ?? json.details?.[0]?.issue;
    throw new Error(detail ?? json.message ?? "PayPal payout failed");
  }
  return json.batch_header?.payout_batch_id ?? `smyd-${row.id}`;
}

/* ---------------- Stripe (bank account / debit card) ---------------- */

export function stripeEnv(): "sandbox" | "live" {
  return process.env["STRIPE_LIVE_API_KEY"] ? "live" : "sandbox";
}

async function sendStripePayout(row: WithdrawalRow): Promise<string> {
  const { data, error } = await (adminDb() as any)
    .from("payout_accounts")
    .select("stripe_account_id, payouts_enabled")
    .eq("user_id", row.user_id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const account = data as { stripe_account_id?: string; payouts_enabled?: boolean } | null;
  if (!account?.stripe_account_id || !account.payouts_enabled) {
    throw new Error("Player has not finished connecting a bank or debit card");
  }

  const stripe = createStripeClient(stripeEnv());
  try {
    const transfer = await stripe.transfers.create(
      {
        amount: row.amount_cents,
        currency: "usd",
        destination: account.stripe_account_id,
        description: "SMYD cash out",
        metadata: { withdrawal_id: row.id, user_id: row.user_id },
      },
      { idempotencyKey: `smyd-payout-${row.id}` },
    );
    return transfer.id;
  } catch (e) {
    throw new Error(getStripeErrorMessage(e));
  }
}

/* ---------------- Runner ---------------- */

export type PayoutRunResult = {
  processed: number;
  paid: number;
  failed: number;
  errors: { id: string; reason: string }[];
};

export async function runDuePayouts(limit = 20): Promise<PayoutRunResult> {
  const db = adminDb();
  const { data, error } = await db.rpc("payouts_claim_due", { _limit: limit });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as WithdrawalRow[];

  const result: PayoutRunResult = { processed: rows.length, paid: 0, failed: 0, errors: [] };

  for (const row of rows) {
    try {
      let provider = "stripe";
      let providerId: string;
      if (row.method === "paypal" || row.method === "venmo") {
        provider = "paypal";
        providerId = await sendPaypalPayout(row);
      } else if (row.method === "bank") {
        providerId = await sendStripePayout(row);
      } else {
        throw new Error("Method must be paid out by hand");
      }
      const { error: markErr } = await db.rpc("payouts_mark_sent", {
        _request_id: row.id,
        _provider: provider,
        _provider_payout_id: providerId,
      });
      if (markErr) throw new Error(markErr.message);
      result.paid += 1;
    } catch (e) {
      const reason = (e as { message?: string })?.message ?? "Payout failed";
      await db.rpc("payouts_mark_failed", { _request_id: row.id, _reason: reason, _refund: true });
      result.failed += 1;
      result.errors.push({ id: row.id, reason });
    }
  }

  return result;
}

/* ---------------- Stripe Connect onboarding ---------------- */

export async function ensureConnectAccount(userId: string, email: string | undefined, returnUrl: string) {
  const db = adminDb();
  const stripe = createStripeClient(stripeEnv());

  const { data } = await db
    .from("payout_accounts")
    .select("stripe_account_id")
    .eq("user_id", userId)
    .maybeSingle();
  let accountId = (data as { stripe_account_id?: string } | null)?.stripe_account_id;

  try {
    if (!accountId) {
      const created = await stripe.accounts.create({
        type: "express",
        country: "US",
        ...(email ? { email } : {}),
        capabilities: { transfers: { requested: true } },
        business_type: "individual",
        metadata: { userId },
      });
      accountId = created.id;
      await db.rpc("payouts_upsert_account", {
        _user_id: userId,
        _stripe_account_id: accountId,
        _details_submitted: false,
        _payouts_enabled: false,
      });
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: returnUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });
    return link.url;
  } catch (e) {
    throw new Error(getStripeErrorMessage(e));
  }
}

export async function syncConnectAccount(userId: string) {
  const db = adminDb();
  const { data } = await db
    .from("payout_accounts")
    .select("stripe_account_id")
    .eq("user_id", userId)
    .maybeSingle();
  const accountId = (data as { stripe_account_id?: string } | null)?.stripe_account_id;
  if (!accountId) return { connected: false, payoutsEnabled: false };

  const stripe = createStripeClient(stripeEnv());
  try {
    const account = await stripe.accounts.retrieve(accountId);
    await db.rpc("payouts_upsert_account", {
      _user_id: userId,
      _stripe_account_id: accountId,
      _details_submitted: Boolean(account.details_submitted),
      _payouts_enabled: Boolean(account.payouts_enabled),
    });
    return { connected: true, payoutsEnabled: Boolean(account.payouts_enabled) };
  } catch (e) {
    throw new Error(getStripeErrorMessage(e));
  }
}

/* ---------------- Funds check (Stripe + PayPal balances) ---------------- */

export type RailFunds = { availableCents: number | null; pendingCents: number | null; error: string | null };

export async function getStripeFunds(): Promise<RailFunds> {
  try {
    const { createStripeClient } = await import("@/lib/stripe.server");
    const bal = await createStripeClient(stripeEnv()).balance.retrieve();
    const sum = (arr: { amount: number; currency: string }[]) =>
      arr.filter((b) => b.currency === "usd").reduce((s, b) => s + b.amount, 0);
    return { availableCents: sum(bal.available), pendingCents: sum(bal.pending), error: null };
  } catch (e) {
    return { availableCents: null, pendingCents: null, error: (e as { message?: string })?.message ?? "Stripe balance unavailable" };
  }
}

export async function getPaypalFunds(): Promise<RailFunds> {
  try {
    const token = await paypalToken();
    const res = await fetch(`${paypalBase()}/v1/reporting/balances?currency_code=USD`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = (await res.json()) as any;
    if (!res.ok) {
      throw new Error(
        res.status === 403
          ? "PayPal won't share your balance — enable 'Transaction Search / Balances' on your PayPal app"
          : json?.message ?? "PayPal balance unavailable",
      );
    }
    const usd = (json.balances ?? []).find((b: any) => b.currency === "USD") ?? json.balances?.[0];
    const toCents = (v?: { value?: string }) => (v?.value ? Math.round(Number(v.value) * 100) : 0);
    return {
      availableCents: toCents(usd?.available_balance ?? usd?.total_balance),
      pendingCents: toCents(usd?.withheld_balance),
      error: null,
    };
  } catch (e) {
    return { availableCents: null, pendingCents: null, error: (e as { message?: string })?.message ?? "PayPal balance unavailable" };
  }
}

export async function getOwedByRail(): Promise<{ stripeCents: number; paypalCents: number }> {
  const { data } = await adminDb()
    .from("withdrawal_requests")
    .select("amount_cents, method, status")
    .in("status", ["pending", "approved", "processing"]);
  let stripeCents = 0;
  let paypalCents = 0;
  for (const r of (data ?? []) as { amount_cents: number; method: string }[]) {
    if (r.method === "bank") stripeCents += Number(r.amount_cents);
    else if (r.method === "paypal" || r.method === "venmo") paypalCents += Number(r.amount_cents);
  }
  return { stripeCents, paypalCents };
}
