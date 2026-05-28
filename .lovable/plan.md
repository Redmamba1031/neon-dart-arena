# SMYD — Money & Commerce Audit + Build Plan

## 1. How the system works today

**Authentication.** Email/password and Google sign-in (via the Lovable broker). `AuthGate` in `__root.tsx` redirects any signed-out visitor to `/login` for every route except `/login` itself. A DB trigger auto-creates a `profiles` row and a `wallets` row on signup.

**Wallet & ledger.** `wallets.balance_cents` holds each user's balance (stored in cents, displayed as "coins" — 100 cents = 1 coin in storage, but UI shows 1:1 coins). Every change goes through `wallet_transactions` (append-only). All balance changes happen inside SECURITY DEFINER RPCs (`_credit_wallet`, `_debit_wallet`) that are only callable from other gameplay RPCs.

**Gameplay economy.** `create_match` / `join_match` debit stakes, `settle_match` credits the winner minus 5% rake. Tournaments mirror the same pattern with 50/30/20 payouts. This part is solid.

**Payments infrastructure (built but dormant).** A full Stripe wiring already exists from an earlier turn: a server function (`createDepositCheckout`), embedded checkout component, webhook route at `/api/public/payments/webhook`, a `credit_wallet_from_deposit` RPC, a `deposits` ledger table, and a `/checkout/return` page. None of it is currently reachable from the UI.

**Catalog.** I created 4 Stripe coin pack products (`coins_500`, `coins_1100`, `coins_3000`, `coins_6500`). They exist at Stripe only — no DB mirror, and the existing checkout flow takes an arbitrary dollar amount, not a `priceId`.

**No subscriptions, no entitlements, no billing periods.** This is a one-time-purchase virtual currency model. That's correct for the product.

## 2. Gaps blocking a working purchase + redemption

1. **Coin packs aren't sellable.** No shop UI, and the existing checkout takes a free-form amount instead of a `priceId`.
2. **Webhook would credit the wrong amount.** It credits `amount_total` USD-cents 1:1 to `balance_cents`. With bonus tiers (e.g. $25 → 3,000 coins, not 2,500), users would be short-changed. There's no `coins_granted` value flowing through metadata.
3. **No gift card system at all** — no redemption table, no Tremendous client, no UI, no fulfillment.
4. **`useDevTopUp` hook still calls `dev_top_up` RPC** but that RPC's EXECUTE was revoked from authenticated users in the last security pass. It's dead code that will throw if anyone calls it.
5. **`StripeDepositCheckout` and `/checkout/return` are still labeled "Deposit"** — branding leak from the removed real-money model.
6. **Wallet page has no "Buy coins" or "Redeem" entry points.** Users can't reach the new flows.
7. **No bottom-nav entry for the shop.** Discoverability gap.
8. **`PaymentTestModeBanner` exists but is not mounted in `AppShell`** — users won't see test mode warnings.
9. **Profile page won't show redemption history** (need to verify after implementation).

## 3. What I'll build

### A. Database (one migration)

- `coin_packs` table: `price_id` (PK, matches Stripe price), `name`, `usd_cents`, `coins_granted`, `display_order`, `active`. Seeded with the 4 packs. Public-readable so the shop can render it. RLS: SELECT for authenticated.
- `gift_card_options` table: `id`, `denomination_usd_cents`, `coins_cost` (using 150 coins = $1 → 750/1,500/3,750/7,500 coins for $5/$10/$25/$50), `active`. Seeded.
- `gift_card_redemptions` table: `id`, `user_id`, `option_id`, `coins_spent`, `denomination_usd_cents`, `status` (pending/fulfilled/failed), `tremendous_order_id`, `tremendous_reward_id`, `delivery_email`, `recipient_name`, `failure_reason`, `created_at`, `fulfilled_at`. RLS: users SELECT/INSERT their own; service_role full.
- Update `credit_wallet_from_deposit(_coins_granted bigint, ...)` — accept coins from webhook metadata instead of deriving from USD amount.
- New RPC `redeem_gift_card(_option_id)` → SECURITY DEFINER: validates option active, debits coins via `_debit_wallet` (kind `withdrawal`), inserts pending redemption row, returns redemption id. Atomic; refund path on Tremendous failure handled by server fn.

### B. Server functions

- `src/lib/coin-packs.functions.ts` → `listCoinPacks()`, `createCoinPackCheckout({ priceId, returnUrl })`. Resolves Stripe price by `lookup_key`, attaches `coins_granted` + `pack_id` + `userId` to `metadata` and `payment_intent_data.metadata`, returns embedded `client_secret`.
- `src/lib/redemptions.functions.ts` → `listGiftCardOptions()`, `createRedemption({ optionId, deliveryEmail, recipientName })`. Calls `redeem_gift_card` RPC (debits coins), then calls Tremendous Orders API immediately. On success → mark `fulfilled`, store order/reward IDs. On failure → mark `failed`, credit coins back via a `_credit_wallet` admin path (new RPC `_refund_redemption(redemption_id)`).
- `src/lib/tremendous.server.ts` → minimal client wrapping `POST /api/v2/orders` with `Authorization: Bearer ${TREMENDOUS_API_KEY}`. Uses Amazon product ID, single-reward order, email delivery.
- Update webhook handler: read `metadata.coins_granted` and `metadata.pack_id`, pass `_coins_granted` to the updated RPC. Reject if metadata missing.

### C. UI

- `src/routes/shop.tsx` — two tabs: "Buy Coins" (lists `coin_packs`, opens embedded Stripe checkout in a modal) and "Redeem" (lists `gift_card_options`, prompts for delivery email, shows recent redemption history).
- `src/components/CoinPackCheckout.tsx` — replaces `StripeEmbeddedCheckout`, takes `priceId` instead of `amountCents`.
- Update `/checkout/return` → rename copy from "Deposit complete" to "Purchase complete".
- Update `AppShell`: swap one bottom-nav item for **Shop** (e.g. replace Wallet's nav slot with Shop, keep Wallet reachable from the header balance pill), or add as 5th item — I'll add as a tab and demote Leaderboard to a link inside Profile, keeping 5 tabs.
- Add `<PaymentTestModeBanner />` to `AppShell` so test-mode purchases are clearly flagged.
- Wallet page: add quick links "Buy more coins" and "Redeem".

### D. Cleanup

- Remove `useDevTopUp` (RPC is unreachable now).
- Remove `formatUsd` alias and update `AppShell` to import `formatCoins`.
- Rename `StripeDepositCheckout` → `CoinPackCheckout`; delete `createDepositCheckout` (replaced).
- Remove the unused `deposits` table writes from the dev_top_up code path (the table itself stays — it logs Stripe purchases now).

### E. Secrets needed

I'll request `TREMENDOUS_API_KEY` (sandbox: `TEST_...`, prod: live key) and `TREMENDOUS_FUNDING_SOURCE_ID` (from your Tremendous dashboard → Funding → copy the funding source ID). The Amazon product ID is hard-coded.

## 4. How to test in the preview

The preview is locked to Stripe **sandbox** and Tremendous **sandbox**, so no real money or real gift cards move.

**Buy coins (Stripe test mode):**
1. Sign in, open **Shop** → **Buy Coins**, pick a pack.
2. In the embedded form:
   - Card number: `4242 4242 4242 4242`
   - Expiry: any future date (e.g. `12 / 34`)
   - CVC: any 3 digits (e.g. `123`)
   - ZIP: any 5 digits (e.g. `12345`)
3. Submit → you'll land on `/checkout/return` → wallet balance updates within a few seconds (Stripe webhook).
4. Other test cards: `4000 0000 0000 0002` (declined), `4000 0025 0000 3155` (requires 3D Secure).

**Redeem a gift card (Tremendous sandbox):**
1. With enough coins, go to **Shop** → **Redeem**, pick a denomination, enter any email you control.
2. Coins debit immediately; the redemption row goes from `pending` → `fulfilled` within a few seconds.
3. In Tremendous sandbox, no real gift card is sent — the order appears in your Tremendous dashboard with status "test". The delivery email will receive a sandbox notification (no real value).

**Edge cases to verify:**
- Insufficient coins → redemption blocked with toast, no debit.
- Tremendous API failure (simulate by setting an invalid API key) → coins automatically refunded, row marked `failed`.
- Refresh the wallet during purchase → realtime subscription should update balance the moment the webhook posts.

## 5. Out of scope (call out for later)

- Refund/chargeback handling for Stripe (we'll log the event but not auto-clawback coins — the existing `deposits` row gives you the audit trail to do it manually).
- Admin dashboard for redemption queue (you picked auto-fulfill; if you ever want a manual queue, the `gift_card_redemptions` table already supports the `pending` state).
- Tax automation (you opted out; revisit before any non-trivial sales volume).
- Per-user redemption velocity limits and email verification gates (you opted out; security memory will be updated to flag this as a known-accepted risk).
