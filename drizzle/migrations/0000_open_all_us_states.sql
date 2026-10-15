UPDATE public.restricted_regions SET active = false WHERE country = 'US';

CREATE OR REPLACE FUNCTION public._assert_region_allowed(_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare _p public.profiles%rowtype; _r public.restricted_regions%rowtype;
begin
  select * into _p from public.profiles where id = _user_id;
  if _p.region_code is null then
    raise exception 'Set your location in your profile before playing for money';
  end if;
  if coalesce(_p.country, 'US') <> 'US' then
    if not coalesce(_p.country, 'US') in ('GB','IE','SE') then
      raise exception 'SMYD paid play is currently available in the United States, the United Kingdom, Ireland and Sweden';
    end if;
    return;
  end if;
  select * into _r from public.restricted_regions where code = _p.region_code and active;
  if found then
    raise exception 'Real-money play is not available in % yet — SMYD paid play is open in every US state, the United Kingdom, Ireland and Sweden', _r.name;
  end if;
end; $function$;