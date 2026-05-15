
create table public.deposits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  stripe_session_id text not null unique,
  stripe_payment_intent text,
  amount_cents bigint not null check (amount_cents > 0),
  status text not null default 'pending',
  environment text not null default 'sandbox',
  credited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_deposits_user_id on public.deposits(user_id);

alter table public.deposits enable row level security;

create policy "Users read own deposits"
  on public.deposits for select
  to authenticated
  using (auth.uid() = user_id);

-- SECURITY DEFINER function the webhook uses to credit wallet atomically and idempotently
create or replace function public.credit_wallet_from_deposit(
  _user_id uuid,
  _session_id text,
  _payment_intent text,
  _amount_cents bigint,
  _environment text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _existing public.deposits%rowtype;
begin
  select * into _existing from public.deposits where stripe_session_id = _session_id for update;
  if found then
    if _existing.status = 'credited' then
      return; -- idempotent
    end if;
    update public.deposits
      set status = 'credited',
          credited_at = now(),
          stripe_payment_intent = coalesce(_payment_intent, stripe_payment_intent),
          updated_at = now()
      where stripe_session_id = _session_id;
  else
    insert into public.deposits (user_id, stripe_session_id, stripe_payment_intent, amount_cents, status, environment, credited_at)
    values (_user_id, _session_id, _payment_intent, _amount_cents, 'credited', _environment, now());
  end if;

  insert into public.wallets (user_id, balance_cents)
    values (_user_id, _amount_cents)
    on conflict (user_id) do update
    set balance_cents = public.wallets.balance_cents + excluded.balance_cents,
        updated_at = now();

  insert into public.wallet_transactions (user_id, kind, amount_cents, note)
  values (_user_id, 'deposit', _amount_cents, 'Stripe deposit ' || _session_id);
end;
$$;
