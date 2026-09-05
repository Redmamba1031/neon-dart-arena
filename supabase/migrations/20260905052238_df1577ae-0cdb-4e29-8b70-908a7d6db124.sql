create or replace function public.create_tournament(_name text, _mode match_mode, _best_of integer, _size integer, _entry_cents bigint, _double_in boolean DEFAULT false, _finish_rule finish_rule DEFAULT 'double'::finish_rule)
returns uuid language plpgsql security definer set search_path to 'public' as $function$
declare _uid uuid := auth.uid(); _tid uuid;
begin
  if _uid is null then raise exception 'Not authenticated'; end if;
  if not public.has_role(_uid, 'owner'::public.app_role) then
    raise exception 'Only the app owner can create tournaments';
  end if;
  if _size not in (4,8,16,32) then raise exception 'Size must be 4, 8, 16, or 32'; end if;
  if _best_of not in (1,3,5) then raise exception 'Invalid best_of'; end if;
  if _entry_cents < 500 or _entry_cents > 100000000 then raise exception 'Entry must be at least 500 coins'; end if;
  if length(coalesce(_name,'')) < 3 or length(_name) > 60 then raise exception 'Name must be 3-60 chars'; end if;

  insert into tournaments(creator_id,name,mode,best_of,size,entry_cents,double_in,finish_rule)
    values(_uid,_name,_mode,_best_of,_size,_entry_cents,_double_in,_finish_rule)
    returning id into _tid;

  perform _debit_wallet(_uid,_entry_cents,'match_stake',null,'Tournament entry: '||_name);
  insert into tournament_participants(tournament_id,user_id) values(_tid,_uid);

  return _tid;
end; $function$;