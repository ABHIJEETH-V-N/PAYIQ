ALTER FUNCTION public.ensure_simulation_wallet() SET SCHEMA payiq_private;
CREATE FUNCTION public.ensure_simulation_wallet() RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT payiq_private.ensure_simulation_wallet() $$;
REVOKE ALL ON FUNCTION public.ensure_simulation_wallet() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ensure_simulation_wallet() TO authenticated;