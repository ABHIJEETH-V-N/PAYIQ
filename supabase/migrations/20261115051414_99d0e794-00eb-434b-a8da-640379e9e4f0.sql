ALTER FUNCTION public.teammate_action(text,uuid,jsonb) SET SCHEMA payiq_private;
ALTER FUNCTION public.teammate_runtime_write(uuid,text,jsonb) SET SCHEMA payiq_private;
CREATE FUNCTION public.teammate_action(p_action text,p_id uuid DEFAULT NULL,p_data jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT payiq_private.teammate_action(p_action,p_id,p_data) $$;
CREATE FUNCTION public.teammate_runtime_write(p_id uuid,p_action text,p_data jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT payiq_private.teammate_runtime_write(p_id,p_action,p_data) $$;
REVOKE ALL ON FUNCTION public.teammate_action(text,uuid,jsonb),public.teammate_runtime_write(uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.teammate_action(text,uuid,jsonb),public.teammate_runtime_write(uuid,text,jsonb) TO authenticated;