ALTER TABLE public.transactions ADD COLUMN from_upi text NOT NULL DEFAULT '', ADD COLUMN to_upi text NOT NULL DEFAULT '', ADD COLUMN from_email text NOT NULL DEFAULT '', ADD COLUMN to_email text NOT NULL DEFAULT '', ADD COLUMN description text NOT NULL DEFAULT '', ADD COLUMN audit_trail jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.transactions DROP CONSTRAINT transactions_source_type_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_source_type_check CHECK(source_type IN ('SYNC_REQUEST','DIRECT_PAYMENT','WALLET_TRANSFER'));
CREATE FUNCTION payiq_private.enrich_wallet_ledger() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE t public.simulation_transfers; s public.sync_requests; BEGIN
IF NEW.is_simulated THEN
SELECT * INTO t FROM public.simulation_transfers WHERE NEW.order_id IN ('SIM-'||id||'-D','SIM-'||id||'-C');
IF FOUND THEN
SELECT * INTO s FROM public.sync_requests WHERE id=t.sync_request_id;
NEW.source_type:=CASE WHEN t.sync_request_id IS NULL THEN 'WALLET_TRANSFER' ELSE 'SYNC_REQUEST' END;
SELECT coalesce(nullif(w.upi_id,''),nullif(w.phone,''),w.email),w.email INTO NEW.from_upi,NEW.from_email FROM public.simulation_wallets w WHERE w.user_id=t.payer_id;
SELECT coalesce(nullif(w.upi_id,''),nullif(w.phone,''),w.email),w.email INTO NEW.to_upi,NEW.to_email FROM public.simulation_wallets w WHERE w.user_id=t.recipient_id;
NEW.description:=coalesce(s.name,'Wallet transfer');
NEW.retry_count:=coalesce(s.retry_attempts,0);
NEW.is_automated:=t.sync_request_id IS NOT NULL AND t.requester_id=t.payer_id AND EXISTS(SELECT 1 FROM public.payment_policies p WHERE p.id=s.policy_id AND NOT p.requires_user_auth AND (p.auto_approve_limit IS NULL OR t.amount<=p.auto_approve_limit));
ELSIF NEW.order_id LIKE 'SIM-TOPUP-%' THEN
NEW.source_type:='WALLET_TRANSFER'; NEW.description:='Add balance'; NEW.from_party:='Balance addition';
SELECT p.name,coalesce(nullif(w.upi_id,''),nullif(w.phone,''),w.email),w.email INTO NEW.to_party,NEW.to_upi,NEW.to_email FROM public.profiles p JOIN public.simulation_wallets w ON w.user_id=p.id WHERE p.id=NEW.user_id;
END IF;
NEW.from_upi:=coalesce(NEW.from_upi,''); NEW.to_upi:=coalesce(NEW.to_upi,''); NEW.from_email:=coalesce(NEW.from_email,''); NEW.to_email:=coalesce(NEW.to_email,'');
END IF;
IF NEW.bank_error IS NOT NULL THEN NEW.bank_error:=CASE WHEN NEW.bank_error ILIKE '%insufficient%' THEN 'INSUFFICIENT_WALLET_BALANCE' WHEN NEW.bank_error ILIKE '%balance limit%' THEN 'RECIPIENT_WALLET_LIMIT' ELSE NEW.bank_error END; END IF;
IF TG_OP='INSERT' THEN NEW.audit_trail:=jsonb_build_array(jsonb_build_object('t',NEW.created_at,'e',CASE WHEN NEW.status='FAILED' THEN 'Transfer attempt failed' ELSE 'Transfer recorded' END)); END IF;
IF NEW.bank_error IS NOT NULL AND (TG_OP='INSERT' OR NEW.bank_error IS DISTINCT FROM OLD.bank_error) THEN NEW.audit_trail:=NEW.audit_trail||jsonb_build_array(jsonb_build_object('t',now(),'e',NEW.bank_error)); END IF;
RETURN NEW; END $$;
REVOKE ALL ON FUNCTION payiq_private.enrich_wallet_ledger() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER enrich_wallet_ledger BEFORE INSERT OR UPDATE OF bank_error ON public.transactions FOR EACH ROW EXECUTE FUNCTION payiq_private.enrich_wallet_ledger();
CREATE FUNCTION payiq_private.append_ledger_audit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN UPDATE public.transactions SET audit_trail=audit_trail||jsonb_build_array(jsonb_build_object('t',NEW.created_at,'e',NEW.event)) WHERE id=NEW.transaction_id AND user_id=NEW.user_id; RETURN NEW; END $$;
REVOKE ALL ON FUNCTION payiq_private.append_ledger_audit() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER append_ledger_audit AFTER INSERT ON public.transaction_events FOR EACH ROW EXECUTE FUNCTION payiq_private.append_ledger_audit();
UPDATE public.transactions SET bank_error=bank_error WHERE is_simulated;
UPDATE public.transactions t SET audit_trail=coalesce((SELECT jsonb_agg(jsonb_build_object('t',e.created_at,'e',e.event) ORDER BY e.created_at,e.id) FROM public.transaction_events e WHERE e.transaction_id=t.id),'[]'::jsonb) WHERE EXISTS(SELECT 1 FROM public.transaction_events e WHERE e.transaction_id=t.id);
CREATE VIEW public.ledger_transactions WITH (security_invoker=true) AS SELECT * FROM public.transactions;
GRANT SELECT ON public.ledger_transactions TO authenticated;
GRANT ALL ON public.ledger_transactions TO service_role;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') AND NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='transactions') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions; END IF; END $$;