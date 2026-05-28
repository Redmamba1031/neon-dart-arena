
-- 1. Tighten user_roles SELECT policy: users can only see their own role.
DROP POLICY IF EXISTS "Anyone authenticated can view roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 2. Lock down Realtime broadcast/presence: only allow subscriptions to topics
-- scoped to the current user (topic must start with the caller's uid).
-- Postgres-changes subscriptions are still gated by RLS on the underlying
-- tables (wallets, wallet_transactions), so wallet realtime keeps working.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read own-topic realtime" ON realtime.messages;
CREATE POLICY "Authenticated can read own-topic realtime"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    realtime.topic() IS NULL
    OR realtime.topic() LIKE auth.uid()::text || ':%'
    OR realtime.topic() = auth.uid()::text
  );

DROP POLICY IF EXISTS "Authenticated can write own-topic realtime" ON realtime.messages;
CREATE POLICY "Authenticated can write own-topic realtime"
  ON realtime.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    realtime.topic() LIKE auth.uid()::text || ':%'
    OR realtime.topic() = auth.uid()::text
  );

-- 3. Revoke EXECUTE on internal helper / privileged functions from clients.
-- These should only be callable by the database itself (via SECURITY DEFINER
-- wrappers) or by service_role (webhooks).
REVOKE EXECUTE ON FUNCTION public._credit_wallet(uuid, bigint, txn_kind, uuid, text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public._debit_wallet(uuid, bigint, txn_kind, uuid, text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public._start_tournament(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public._build_bracket_4(uuid, uuid[]) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public._build_bracket_8(uuid, uuid[]) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public._build_bracket_se(uuid, uuid[]) FROM anon, authenticated, public;

-- credit_wallet_from_deposit is invoked from the Stripe webhook server route
-- using the service-role client; no end-user should be able to call it.
REVOKE EXECUTE ON FUNCTION public.credit_wallet_from_deposit(uuid, text, text, bigint, text) FROM anon, authenticated, public;

-- dev_top_up was a dev-only helper; payments are now coin-based via play,
-- so remove its public exposure.
REVOKE EXECUTE ON FUNCTION public.dev_top_up(bigint) FROM anon, authenticated, public;
