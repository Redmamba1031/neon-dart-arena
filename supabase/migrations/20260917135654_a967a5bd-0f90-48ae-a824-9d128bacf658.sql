
CREATE TABLE IF NOT EXISTS public.profile_locations (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  lat double precision,
  lng double precision,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_locations TO authenticated;
GRANT ALL ON public.profile_locations TO service_role;

ALTER TABLE public.profile_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own coordinates" ON public.profile_locations;
CREATE POLICY "Users manage their own coordinates"
ON public.profile_locations FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

INSERT INTO public.profile_locations (user_id, lat, lng)
SELECT id, lat, lng FROM public.profiles WHERE lat IS NOT NULL OR lng IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

ALTER TABLE public.profiles DROP COLUMN IF EXISTS lat;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS lng;

CREATE OR REPLACE FUNCTION public.update_my_location(_country text, _region_code text, _region_name text, _city text, _lat double precision DEFAULT NULL::double precision, _lng double precision DEFAULT NULL::double precision, _source text DEFAULT 'manual'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare _uid uuid := auth.uid();
begin
  if _uid is null then raise exception 'Not authenticated'; end if;
  if _region_code is null or length(trim(_region_code)) < 2 then
    raise exception 'A state or region is required';
  end if;
  update public.profiles set
    country = coalesce(nullif(trim(_country), ''), 'US'),
    region_code = upper(trim(_region_code)),
    region_name = nullif(trim(_region_name), ''),
    city = nullif(trim(_city), ''),
    location_source = case when _source in ('device','manual') then _source else 'manual' end,
    location_updated_at = now(),
    updated_at = now()
  where id = _uid;

  insert into public.profile_locations (user_id, lat, lng, updated_at)
  values (_uid, _lat, _lng, now())
  on conflict (user_id) do update set lat = excluded.lat, lng = excluded.lng, updated_at = now();
end; $function$;

-- Returns only rounded distances in miles from the caller to the given users.
CREATE OR REPLACE FUNCTION public.distances_from_me(_ids uuid[])
RETURNS TABLE(user_id uuid, miles integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  select l.user_id,
         round(
           3958.8 * 2 * asin(sqrt(
             power(sin(radians(l.lat - me.lat) / 2), 2) +
             cos(radians(me.lat)) * cos(radians(l.lat)) *
             power(sin(radians(l.lng - me.lng) / 2), 2)
           ))
         )::int as miles
  from public.profile_locations l
  cross join (
    select lat, lng from public.profile_locations where user_id = auth.uid()
  ) me
  where auth.uid() is not null
    and l.user_id = any(_ids)
    and l.lat is not null and l.lng is not null
    and me.lat is not null and me.lng is not null;
$function$;

REVOKE ALL ON FUNCTION public.distances_from_me(uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.distances_from_me(uuid[]) TO authenticated;
