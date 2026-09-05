REVOKE EXECUTE ON FUNCTION public.create_match(match_mode, integer, bigint, boolean, finish_rule, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.respond_challenge(uuid, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.start_leg(uuid, match_mode) FROM anon;
REVOKE EXECUTE ON FUNCTION public.record_dart(uuid, integer, integer, integer, integer, boolean, integer, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.complete_leg(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.settle_match(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.join_match(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cancel_match(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_tournament(text, match_mode, integer, integer, bigint, boolean, finish_rule) FROM anon;
REVOKE EXECUTE ON FUNCTION public.join_tournament(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cancel_tournament(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.report_tournament_match(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.redeem_gift_card(text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;

REVOKE EXECUTE ON FUNCTION public.protect_profile_stats() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_wallet() FROM anon, authenticated;