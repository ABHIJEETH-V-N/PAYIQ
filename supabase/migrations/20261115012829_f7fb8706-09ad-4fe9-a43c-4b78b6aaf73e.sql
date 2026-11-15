CREATE OR REPLACE FUNCTION payiq_private.search_simulation_recipient(p_query text)
 RETURNS TABLE(user_id uuid, name text, alias text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE q text := lower(trim(p_query)); d text := regexp_replace(p_query,'[^0-9]','','g');
BEGIN
IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
PERFORM public.ensure_simulation_wallet();
IF EXISTS(SELECT 1 FROM public.simulation_wallets s WHERE s.user_id=auth.uid() AND ((s.email=q AND s.email<>'') OR (s.upi_id=q AND s.upi_id<>'') OR (s.phone<>'' AND length(d)>=10 AND (s.phone=d OR right(s.phone,10)=right(d,10))))) THEN
  RAISE EXCEPTION 'That is your own account. Enter the recipient''s email, UPI ID or phone.';
END IF;
RETURN QUERY SELECT w.user_id,p.name,
 CASE WHEN w.email=q THEN w.email WHEN w.upi_id=q THEN w.upi_id ELSE w.phone END
 FROM public.simulation_wallets w JOIN public.profiles p ON p.id=w.user_id
 WHERE w.discoverable AND w.user_id<>auth.uid() AND ((w.email=q AND w.email<>'') OR (w.upi_id=q AND w.upi_id<>'')
   OR (w.phone<>'' AND length(d)>=10 AND (w.phone=d OR right(w.phone,10)=right(d,10))))
 LIMIT 2;
END $function$;