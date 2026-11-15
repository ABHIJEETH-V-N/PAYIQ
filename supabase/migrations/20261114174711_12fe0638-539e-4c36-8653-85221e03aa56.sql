ALTER FUNCTION public.lookup_wallet_recipient(text) SET SCHEMA payiq_private;
CREATE FUNCTION public.lookup_wallet_recipient(p_query text) RETURNS TABLE(user_id uuid,name text,alias text,email text) LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT * FROM payiq_private.lookup_wallet_recipient(p_query) $$;
REVOKE ALL ON FUNCTION public.lookup_wallet_recipient(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.lookup_wallet_recipient(text) TO authenticated;
ALTER FUNCTION public.execute_smart_transfer(uuid,numeric) SET SCHEMA payiq_private;
CREATE FUNCTION public.execute_smart_transfer(p_sync uuid,p_amount numeric DEFAULT NULL) RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT payiq_private.execute_smart_transfer(p_sync,p_amount) $$;
REVOKE ALL ON FUNCTION public.execute_smart_transfer(uuid,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.execute_smart_transfer(uuid,numeric) TO authenticated;