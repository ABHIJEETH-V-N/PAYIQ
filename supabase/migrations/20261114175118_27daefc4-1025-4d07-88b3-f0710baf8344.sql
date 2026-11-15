-- lovable-cron-fallback-reviewed: five-second retry timing requires SQL scheduling; wake on queued deadlines and unschedule after drain rather than permanent polling.
CREATE EXTENSION IF NOT EXISTS pg_cron;
DROP INDEX public.simulation_sync_once;
CREATE UNIQUE INDEX simulation_sync_once ON public.simulation_transfers(sync_request_id) WHERE sync_request_id IS NOT NULL AND status='AWAITING_USER_AUTH';
CREATE OR REPLACE FUNCTION payiq_private.execute_smart_transfer(p_sync uuid,p_amount numeric DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE s public.sync_requests; pol public.payment_policies; person uuid; result uuid; amt numeric; existing public.simulation_transfers; BEGIN
IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
SELECT * INTO s FROM public.sync_requests WHERE id=p_sync AND user_id=auth.uid() FOR UPDATE;
IF NOT FOUND THEN RAISE EXCEPTION 'Smart Transfer not found'; END IF;
SELECT * INTO pol FROM public.payment_policies WHERE id=s.policy_id AND user_id=auth.uid();
IF NOT FOUND THEN RAISE EXCEPTION 'Policy not found'; END IF;
IF pol.execution_date IS NOT NULL AND pol.execution_date>current_date AND s.last_at IS NULL THEN UPDATE public.sync_requests SET next_execution_at=(pol.execution_date::timestamp AT TIME ZONE 'Asia/Kolkata') WHERE id=s.id; RETURN NULL; END IF;
IF s.next_execution_at IS NOT NULL AND s.next_execution_at>now() THEN RETURN NULL; END IF;
SELECT * INTO existing FROM public.simulation_transfers WHERE sync_request_id=s.id AND (status='AWAITING_USER_AUTH' OR (status='SUCCESS' AND (pol.frequency='ONCE' OR s.next_execution_at IS NULL))) ORDER BY created_at DESC LIMIT 1;
IF FOUND THEN RETURN existing.id; END IF;
IF s.retry_attempts>=pol.max_retries AND s.status='FAILED' THEN RAISE EXCEPTION 'Retry limit reached'; END IF;
amt:=coalesce(p_amount,s.amount); IF amt IS NULL THEN RAISE EXCEPTION 'Review and enter an exact amount'; END IF;
SELECT r.user_id INTO person FROM public.lookup_wallet_recipient(s.counterparty_address) r;
IF person IS NULL AND s.counterparty_email<>'' THEN SELECT r.user_id INTO person FROM public.lookup_wallet_recipient(s.counterparty_email) r; END IF;
IF person IS NULL THEN RAISE EXCEPTION 'Registered recipient not found or lookup disabled'; END IF;
IF s.status='FAILED' THEN UPDATE public.sync_requests SET retry_attempts=retry_attempts+1 WHERE id=s.id; INSERT INTO public.notifications(user_id,title,message,type) VALUES(person,'Smart Transfer retry','Retry '||(s.retry_attempts+1)||' of '||pol.max_retries||' · ₹'||amt,'RETRY'); END IF;
result:=payiq_private.prepare_simulation_transfer(person,amt,s.id);
IF s.direction='DEBIT' AND NOT pol.requires_user_auth AND (pol.auto_approve_limit IS NULL OR amt<=pol.auto_approve_limit) THEN PERFORM payiq_private.confirm_simulation_transfer(result);
ELSE UPDATE public.sync_requests SET status='AWAITING_USER_AUTH',next_execution_at=NULL WHERE id=s.id; END IF;
RETURN result; END $$;
CREATE FUNCTION payiq_private.run_due_smart_transfers() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE s record; old_claim text:=current_setting('request.jwt.claim.sub',true); BEGIN
PERFORM pg_advisory_xact_lock(77881234);
FOR s IN SELECT id,user_id,amount FROM public.sync_requests WHERE next_execution_at<=now() AND amount_type='FIXED' AND status IN ('DRAFT','ACTIVE','FAILED') ORDER BY next_execution_at LIMIT 100 FOR UPDATE SKIP LOCKED LOOP
BEGIN PERFORM set_config('request.jwt.claim.sub',s.user_id::text,true); PERFORM payiq_private.execute_smart_transfer(s.id,s.amount);
EXCEPTION WHEN OTHERS THEN UPDATE public.sync_requests SET next_execution_at=NULL WHERE id=s.id; INSERT INTO public.notifications(user_id,title,message,type) VALUES(s.user_id,'Smart Transfer needs attention','Execution stopped: '||SQLERRM,'FAILURE'); END;
END LOOP; PERFORM set_config('request.jwt.claim.sub',coalesce(old_claim,''),true);
IF NOT EXISTS(SELECT 1 FROM public.sync_requests WHERE next_execution_at IS NOT NULL AND amount_type='FIXED' AND status IN ('DRAFT','ACTIVE','FAILED')) AND EXISTS(SELECT 1 FROM cron.job WHERE jobname='payiq-smart-transfers') THEN PERFORM cron.unschedule('payiq-smart-transfers'); END IF;
END $$;
REVOKE ALL ON FUNCTION payiq_private.run_due_smart_transfers() FROM PUBLIC,anon,authenticated;
CREATE FUNCTION payiq_private.arm_smart_transfers() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
IF NEW.next_execution_at IS NOT NULL AND NEW.amount_type='FIXED' THEN PERFORM pg_advisory_xact_lock(77881234); IF NOT EXISTS(SELECT 1 FROM cron.job WHERE jobname='payiq-smart-transfers') THEN PERFORM cron.schedule('payiq-smart-transfers','5 seconds','SELECT payiq_private.run_due_smart_transfers()'); END IF; END IF; RETURN NEW; END $$;
REVOKE ALL ON FUNCTION payiq_private.arm_smart_transfers() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER smart_transfers_arm AFTER INSERT OR UPDATE OF next_execution_at ON public.sync_requests FOR EACH ROW EXECUTE FUNCTION payiq_private.arm_smart_transfers();