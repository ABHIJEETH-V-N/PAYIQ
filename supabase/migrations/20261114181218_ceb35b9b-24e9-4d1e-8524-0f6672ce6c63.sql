-- lovable-cron-fallback-reviewed: reuse existing bounded five-second retry queue for reminder deadlines, wake on enqueue and unschedule after drain; no delayed-workflow provider is enabled.
ALTER TABLE public.sync_requests ADD COLUMN reminder_cadence text NOT NULL DEFAULT 'NONE' CHECK(reminder_cadence IN ('NONE','5_HOURS','10_HOURS','MORNING','DUE_FAILURE')), ADD COLUMN email_reminders boolean NOT NULL DEFAULT true, ADD COLUMN next_reminder_at timestamptz;
ALTER TABLE public.sync_requests DROP CONSTRAINT sync_requests_status_check;
ALTER TABLE public.sync_requests ADD CONSTRAINT sync_requests_status_check CHECK(status IN ('DRAFT','ACTIVE','RETRYING_1_OF_2','FAILED','AWAITING_USER_AUTH','COMPLETED','CANCELLED'));
ALTER TABLE public.notifications ADD COLUMN sync_request_id uuid REFERENCES public.sync_requests(id) ON DELETE SET NULL, ADD COLUMN send_email boolean NOT NULL DEFAULT true;
ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK(type IN ('COLLECTION','APPROVAL','TRANSFER','FAILURE','RETRY','REMINDER','DECLINED'));
CREATE FUNCTION payiq_private.next_reminder(cadence text, at_time timestamptz) RETURNS timestamptz LANGUAGE sql IMMUTABLE SET search_path='' AS $$ SELECT CASE cadence WHEN '5_HOURS' THEN at_time+interval '5 hours' WHEN '10_HOURS' THEN at_time+interval '10 hours' WHEN 'MORNING' THEN ((date_trunc('day',at_time AT TIME ZONE 'Asia/Kolkata')+interval '9 hours'+CASE WHEN (at_time AT TIME ZONE 'Asia/Kolkata')::time >= time '09:00' THEN interval '1 day' ELSE interval '0 days' END) AT TIME ZONE 'Asia/Kolkata') ELSE NULL END $$;
REVOKE ALL ON FUNCTION payiq_private.next_reminder(text,timestamptz) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION payiq_private.sync_workflow() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
IF TG_OP='UPDATE' THEN
IF current_user IN ('authenticated','anon') AND EXISTS(SELECT 1 FROM public.simulation_transfers WHERE sync_request_id=OLD.id AND status='AWAITING_USER_AUTH') AND (NEW.direction IS DISTINCT FROM OLD.direction OR NEW.amount IS DISTINCT FROM OLD.amount OR NEW.max_cap IS DISTINCT FROM OLD.max_cap OR NEW.counterparty_address IS DISTINCT FROM OLD.counterparty_address OR NEW.policy_id IS DISTINCT FROM OLD.policy_id) THEN RAISE EXCEPTION 'Decline or cancel the pending request before changing its amount, recipient or policy'; END IF;
IF NEW.status='ACTIVE' AND NEW.last_at IS DISTINCT FROM OLD.last_at AND EXISTS(SELECT 1 FROM public.payment_policies WHERE id=NEW.policy_id AND frequency='ONCE') THEN NEW.status:='COMPLETED'; NEW.next_execution_at:=NULL; END IF;
END IF;
IF NEW.status IN ('COMPLETED','CANCELLED') OR NEW.reminder_cadence IN ('NONE','DUE_FAILURE') THEN NEW.next_reminder_at:=NULL;
ELSIF TG_OP='INSERT' THEN NEW.next_reminder_at:=payiq_private.next_reminder(NEW.reminder_cadence,now());
ELSIF NEW.reminder_cadence IS DISTINCT FROM OLD.reminder_cadence OR (NEW.next_reminder_at IS NULL AND NEW.status IS DISTINCT FROM OLD.status) THEN NEW.next_reminder_at:=payiq_private.next_reminder(NEW.reminder_cadence,now()); END IF;
RETURN NEW; END $$;
REVOKE ALL ON FUNCTION payiq_private.sync_workflow() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER zz_sync_workflow BEFORE INSERT OR UPDATE ON public.sync_requests FOR EACH ROW EXECUTE FUNCTION payiq_private.sync_workflow();
CREATE FUNCTION payiq_private.classify_smart_ledger() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN IF NEW.is_simulated THEN NEW.is_automated:=NEW.source_type='SYNC_REQUEST'; END IF; RETURN NEW; END $$;
REVOKE ALL ON FUNCTION payiq_private.classify_smart_ledger() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER zz_classify_smart_ledger BEFORE INSERT OR UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION payiq_private.classify_smart_ledger();
UPDATE public.transactions SET is_automated=(source_type='SYNC_REQUEST') WHERE is_simulated;
UPDATE public.sync_requests s SET status='COMPLETED',next_execution_at=NULL WHERE s.status='ACTIVE' AND s.approved_at IS NOT NULL AND EXISTS(SELECT 1 FROM public.payment_policies p WHERE p.id=s.policy_id AND p.frequency='ONCE');
CREATE OR REPLACE FUNCTION payiq_private.notify_transfer() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE target uuid; kind text; heading text; s public.sync_requests; sender text; BEGIN
SELECT * INTO s FROM public.sync_requests WHERE id=NEW.sync_request_id;
SELECT coalesce(nullif(name,''),'A payIQ user') INTO sender FROM public.profiles WHERE id=NEW.requester_id;
IF TG_OP='INSERT' AND NEW.status='AWAITING_USER_AUTH' THEN target:=NEW.payer_id; kind:=CASE WHEN NEW.requester_id<>NEW.payer_id THEN 'COLLECTION' ELSE 'APPROVAL' END; heading:=CASE WHEN kind='COLLECTION' THEN sender||' requested ₹'||NEW.amount ELSE 'Awaiting Approval' END;
ELSIF TG_OP='UPDATE' AND NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('SUCCESS','FAILED','CANCELLED') THEN target:=NEW.recipient_id; kind:=CASE NEW.status WHEN 'SUCCESS' THEN 'TRANSFER' WHEN 'CANCELLED' THEN 'DECLINED' ELSE 'FAILURE' END; heading:=CASE NEW.status WHEN 'SUCCESS' THEN 'Transfer received' WHEN 'CANCELLED' THEN 'Smart Transfer declined' ELSE 'Smart Transfer failed' END;
ELSE RETURN NEW; END IF;
INSERT INTO public.notifications(user_id,title,message,type,related_id,sync_request_id,send_email) VALUES(target,heading,coalesce(s.name,'Wallet transfer')||' · ₹'||NEW.amount||' · Cap: '||coalesce('₹'||s.max_cap,'No cap')||' · '||NEW.status,kind,NEW.id,NEW.sync_request_id,coalesce(s.email_updates,true));
IF kind='FAILURE' THEN INSERT INTO public.notifications(user_id,title,message,type,related_id,sync_request_id,send_email) VALUES(NEW.payer_id,heading,'Amount: ₹'||NEW.amount,kind,NEW.id,NEW.sync_request_id,coalesce(s.email_updates,true)); END IF;
IF NEW.status IN ('SUCCESS','FAILED','CANCELLED') THEN UPDATE public.notifications SET is_read=true WHERE related_id=NEW.id AND type IN ('COLLECTION','APPROVAL','REMINDER'); END IF;
IF NEW.status='CANCELLED' AND NEW.sync_request_id IS NOT NULL THEN UPDATE public.sync_requests SET status='CANCELLED',next_execution_at=NULL,next_reminder_at=NULL WHERE id=NEW.sync_request_id; END IF;
RETURN NEW; END $$;
CREATE FUNCTION payiq_private.pending_collection_requests() RETURNS TABLE(id uuid,sync_request_id uuid,amount numeric,name text,sender_name text,max_cap numeric,reminder_cadence text) LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT t.id,t.sync_request_id,t.amount,s.name,coalesce(nullif(p.name,''),'A payIQ user'),s.max_cap,s.reminder_cadence FROM public.simulation_transfers t JOIN public.sync_requests s ON s.id=t.sync_request_id JOIN public.profiles p ON p.id=t.requester_id WHERE t.payer_id=auth.uid() AND t.requester_id<>auth.uid() AND t.status='AWAITING_USER_AUTH' ORDER BY t.created_at DESC $$;
REVOKE ALL ON FUNCTION payiq_private.pending_collection_requests() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION payiq_private.pending_collection_requests() TO authenticated;
CREATE FUNCTION public.pending_collection_requests() RETURNS TABLE(id uuid,sync_request_id uuid,amount numeric,name text,sender_name text,max_cap numeric,reminder_cadence text) LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT * FROM payiq_private.pending_collection_requests() $$;
REVOKE ALL ON FUNCTION public.pending_collection_requests() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.pending_collection_requests() TO authenticated;
CREATE FUNCTION payiq_private.send_smart_reminder(p_sync uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE s public.sync_requests; t public.simulation_transfers; target uuid; notice uuid; sender text; BEGIN
SELECT * INTO s FROM public.sync_requests WHERE id=p_sync AND user_id=auth.uid() FOR UPDATE;
IF NOT FOUND THEN RAISE EXCEPTION 'Smart Transfer not found'; END IF;
IF s.status IN ('COMPLETED','CANCELLED') THEN RAISE EXCEPTION 'This Smart Transfer is no longer active'; END IF;
SELECT * INTO t FROM public.simulation_transfers WHERE sync_request_id=s.id AND status='AWAITING_USER_AUTH' ORDER BY created_at DESC LIMIT 1;
IF FOUND THEN target:=CASE WHEN s.direction='CREDIT' THEN t.payer_id ELSE t.recipient_id END;
ELSE SELECT r.user_id INTO target FROM payiq_private.lookup_wallet_recipient(s.counterparty_address) r; IF target IS NULL AND s.counterparty_email<>'' THEN SELECT r.user_id INTO target FROM payiq_private.lookup_wallet_recipient(s.counterparty_email) r; END IF; END IF;
IF target IS NULL THEN RAISE EXCEPTION 'Registered recipient not found or lookup disabled'; END IF;
SELECT coalesce(nullif(name,''),'A payIQ user') INTO sender FROM public.profiles WHERE id=s.user_id;
INSERT INTO public.notifications(user_id,title,message,type,related_id,sync_request_id,send_email) VALUES(target,'Smart Transfer reminder',sender||' · '||s.name||' · Amount: '||coalesce('₹'||coalesce(t.amount,s.amount),'Variable')||' · Cap: '||coalesce('₹'||s.max_cap,'No cap')||' · '||s.status,'REMINDER',t.id,s.id,s.email_reminders) RETURNING id INTO notice;
INSERT INTO public.notifications(user_id,title,message,type,sync_request_id,send_email) VALUES(s.user_id,'Reminder sent',s.name||' · '||s.status,'REMINDER',s.id,false);
RETURN notice; END $$;
REVOKE ALL ON FUNCTION payiq_private.send_smart_reminder(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION payiq_private.send_smart_reminder(uuid) TO authenticated;
CREATE FUNCTION public.send_smart_reminder(p_sync uuid) RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT payiq_private.send_smart_reminder(p_sync) $$;
REVOKE ALL ON FUNCTION public.send_smart_reminder(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.send_smart_reminder(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION payiq_private.run_due_smart_transfers() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE s record; old_claim text:=current_setting('request.jwt.claim.sub',true); BEGIN
PERFORM pg_advisory_xact_lock(77881234);
FOR s IN SELECT id,user_id,amount,reminder_cadence FROM public.sync_requests WHERE next_execution_at<=now() AND amount_type='FIXED' AND status IN ('DRAFT','ACTIVE','FAILED') ORDER BY next_execution_at LIMIT 100 FOR UPDATE SKIP LOCKED LOOP
BEGIN PERFORM set_config('request.jwt.claim.sub',s.user_id::text,true); IF s.reminder_cadence='DUE_FAILURE' THEN PERFORM payiq_private.send_smart_reminder(s.id); END IF; PERFORM payiq_private.execute_smart_transfer(s.id,s.amount);
EXCEPTION WHEN OTHERS THEN UPDATE public.sync_requests SET next_execution_at=NULL WHERE id=s.id; INSERT INTO public.notifications(user_id,title,message,type,sync_request_id) VALUES(s.user_id,'Smart Transfer needs attention','Execution stopped: '||SQLERRM,'FAILURE',s.id); END;
END LOOP;
FOR s IN SELECT id,user_id,reminder_cadence FROM public.sync_requests WHERE next_reminder_at<=now() AND status NOT IN ('COMPLETED','CANCELLED') ORDER BY next_reminder_at LIMIT 100 FOR UPDATE SKIP LOCKED LOOP
BEGIN PERFORM set_config('request.jwt.claim.sub',s.user_id::text,true); PERFORM payiq_private.send_smart_reminder(s.id); UPDATE public.sync_requests SET next_reminder_at=payiq_private.next_reminder(s.reminder_cadence,now()) WHERE id=s.id;
EXCEPTION WHEN OTHERS THEN UPDATE public.sync_requests SET next_reminder_at=NULL WHERE id=s.id; INSERT INTO public.notifications(user_id,title,message,type,sync_request_id,send_email) VALUES(s.user_id,'Reminder needs attention',SQLERRM,'FAILURE',s.id,false); END;
END LOOP;
PERFORM set_config('request.jwt.claim.sub',coalesce(old_claim,''),true);
IF NOT EXISTS(SELECT 1 FROM public.sync_requests WHERE (next_execution_at IS NOT NULL AND amount_type='FIXED' AND status IN ('DRAFT','ACTIVE','FAILED')) OR (next_reminder_at IS NOT NULL AND status NOT IN ('COMPLETED','CANCELLED'))) AND EXISTS(SELECT 1 FROM cron.job WHERE jobname='payiq-smart-transfers') THEN PERFORM cron.unschedule('payiq-smart-transfers'); END IF;
END $$;
CREATE OR REPLACE FUNCTION payiq_private.arm_smart_transfers() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
IF (NEW.next_execution_at IS NOT NULL AND NEW.amount_type='FIXED') OR NEW.next_reminder_at IS NOT NULL THEN PERFORM pg_advisory_xact_lock(77881234); IF NOT EXISTS(SELECT 1 FROM cron.job WHERE jobname='payiq-smart-transfers') THEN PERFORM cron.schedule('payiq-smart-transfers','5 seconds','SELECT payiq_private.run_due_smart_transfers()'); END IF; END IF; RETURN NEW; END $$;
DROP TRIGGER smart_transfers_arm ON public.sync_requests;
CREATE TRIGGER smart_transfers_arm AFTER INSERT OR UPDATE ON public.sync_requests FOR EACH ROW EXECUTE FUNCTION payiq_private.arm_smart_transfers();