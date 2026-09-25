ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS id_document_path text, ADD COLUMN IF NOT EXISTS id_document_uploaded_at timestamptz;

CREATE POLICY "Owner uploads own ID" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'id-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Owner or staff read ID" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'id-documents' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_staff(auth.uid())));

CREATE OR REPLACE FUNCTION public.set_my_id_document(_path text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF _path IS NULL OR split_part(_path, '/', 1) <> auth.uid()::text THEN
    RAISE EXCEPTION 'Invalid ID upload';
  END IF;
  UPDATE public.profiles
  SET id_document_path = _path, id_document_uploaded_at = now(), age_verified = false, age_verified_at = NULL
  WHERE id = auth.uid();
END; $$;
REVOKE ALL ON FUNCTION public.set_my_id_document(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_my_id_document(text) TO authenticated;

DROP FUNCTION IF EXISTS public.admin_list_players();
CREATE FUNCTION public.admin_list_players()
RETURNS TABLE(user_id uuid, username text, display_name text, legal_name text, date_of_birth date, age integer,
  age_verified boolean, email text, banned boolean, wins integer, losses integer, created_at timestamptz,
  id_document_path text, id_document_uploaded_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._require_staff();
  RETURN QUERY
  SELECT p.id, p.username, p.display_name, p.legal_name, p.date_of_birth,
    CASE WHEN p.date_of_birth IS NULL THEN NULL ELSE date_part('year', age(p.date_of_birth))::integer END,
    p.age_verified, u.email::text,
    EXISTS (SELECT 1 FROM public.player_bans b WHERE b.user_id = p.id),
    p.wins, p.losses, p.created_at, p.id_document_path, p.id_document_uploaded_at
  FROM public.profiles p JOIN auth.users u ON u.id = p.id
  ORDER BY p.created_at DESC;
END; $$;
REVOKE ALL ON FUNCTION public.admin_list_players() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_players() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_age_verified(_user_id uuid, _verified boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._require_staff();
  IF _verified AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND id_document_path IS NOT NULL) THEN
    RAISE EXCEPTION 'Player must upload a photo ID before they can be verified';
  END IF;
  UPDATE public.profiles
  SET age_verified = _verified, age_verified_at = CASE WHEN _verified THEN now() ELSE NULL END
  WHERE id = _user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Player not found'; END IF;
  PERFORM public._log_admin(CASE WHEN _verified THEN 'age_verified' ELSE 'age_unverified' END, _user_id, NULL, NULL, NULL);
END; $$;

CREATE OR REPLACE FUNCTION public._assert_age_verified(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p public.profiles%rowtype;
BEGIN
  SELECT * INTO _p FROM public.profiles WHERE id = _user_id;
  IF _p.legal_name IS NULL OR _p.date_of_birth IS NULL THEN
    RAISE EXCEPTION 'Submit your legal name and date of birth in your profile before playing for money';
  END IF;
  IF _p.id_document_path IS NULL AND NOT public.is_staff(_user_id) THEN
    RAISE EXCEPTION 'Upload a photo ID before playing for money';
  END IF;
  IF NOT coalesce(_p.age_verified, false) THEN
    RAISE EXCEPTION 'Your age must be verified by SMYD staff before you can play for money';
  END IF;
END; $$;
REVOKE EXECUTE ON FUNCTION public._assert_age_verified(uuid) FROM public, anon, authenticated;