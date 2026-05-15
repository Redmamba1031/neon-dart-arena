-- Roles infrastructure
CREATE TYPE public.app_role AS ENUM ('owner');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Anyone authenticated can view roles"
  ON public.user_roles FOR SELECT TO authenticated USING (true);

-- Seed the owner by email
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'owner'::public.app_role
FROM auth.users WHERE email = 'redmond1031@gmail.com'
ON CONFLICT DO NOTHING;

-- Gate create_tournament to owners only
CREATE OR REPLACE FUNCTION public.create_tournament(_name text, _mode match_mode, _best_of integer, _size integer, _entry_cents bigint, _double_in boolean DEFAULT false, _finish_rule finish_rule DEFAULT 'double'::finish_rule)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare _uid uuid := auth.uid(); _tid uuid;
begin
  if _uid is null then raise exception 'Not authenticated'; end if;
  if not public.has_role(_uid, 'owner'::public.app_role) then
    raise exception 'Only the app owner can create tournaments';
  end if;
  if _size not in (4,8) then raise exception 'Size must be 4 or 8'; end if;
  if _best_of not in (1,3,5) then raise exception 'Invalid best_of'; end if;
  if _entry_cents < 100 or _entry_cents > 100000000 then raise exception 'Entry out of range'; end if;
  if length(coalesce(_name,'')) < 3 or length(_name) > 60 then raise exception 'Name must be 3-60 chars'; end if;

  insert into tournaments(creator_id,name,mode,best_of,size,entry_cents,double_in,finish_rule)
    values(_uid,_name,_mode,_best_of,_size,_entry_cents,_double_in,_finish_rule)
    returning id into _tid;

  perform _debit_wallet(_uid,_entry_cents,'match_stake',null,'Tournament entry: '||_name);
  insert into tournament_participants(tournament_id,user_id) values(_tid,_uid);

  return _tid;
end; $function$;