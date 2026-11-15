CREATE FUNCTION payiq_private.redact_team_json(v jsonb) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE output jsonb; k text; item jsonb; s text;
BEGIN
IF jsonb_typeof(v)='object' THEN output:='{}'; FOR k,item IN SELECT key,value FROM jsonb_each(v) LOOP IF k !~* '(secret|token|password|authorization|account_number)' THEN output:=output||jsonb_build_object(k,payiq_private.redact_team_json(item)); END IF; END LOOP; RETURN output;
ELSIF jsonb_typeof(v)='array' THEN SELECT coalesce(jsonb_agg(payiq_private.redact_team_json(value)),'[]') INTO output FROM jsonb_array_elements(v); RETURN output;
ELSIF jsonb_typeof(v)='string' THEN s:=v#>>'{}'; IF s ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RETURN v; END IF;
s:=regexp_replace(s,'(postgres(ql)?|mysql)://[^[:space:]]+','[REDACTED CONNECTION]','gi');
s:=regexp_replace(s,'(Bearer[[:space:]]+[^[:space:]]+|(sk_|gsk_|sb_secret_)[a-zA-Z0-9_-]+)','[REDACTED SECRET]','gi');
s:=regexp_replace(s,'(password|passwd|otp|api[ _-]?key|token)[[:space:]]*[:=]?[[:space:]]*[^[:space:]]+','[REDACTED SECRET]','gi');
s:=regexp_replace(s,'\m[A-Z]{5}[0-9]{4}[A-Z]\M','[REDACTED PAN]','gi');
s:=regexp_replace(s,'\m([0-9][ -]?){10,19}\M','[REDACTED NUMBER]','g');
s:=regexp_replace(s,'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}','[REDACTED EMAIL]','g'); RETURN to_jsonb(s);
ELSE RETURN v; END IF; END $$;
REVOKE ALL ON FUNCTION payiq_private.redact_team_json(jsonb) FROM PUBLIC; GRANT EXECUTE ON FUNCTION payiq_private.redact_team_json(jsonb) TO authenticated,service_role;
CREATE FUNCTION payiq_private.sanitize_team_row() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
IF TG_TABLE_NAME='teammates' THEN NEW.spec:=payiq_private.redact_team_json(NEW.spec); NEW.name:=payiq_private.redact_team_json(to_jsonb(NEW.name))#>>'{}'; NEW.goal:=payiq_private.redact_team_json(to_jsonb(NEW.goal))#>>'{}';
ELSIF TG_TABLE_NAME='teammate_audit' THEN NEW.summary:=payiq_private.redact_team_json(NEW.summary);
ELSE NEW.data:=payiq_private.redact_team_json(NEW.data); END IF; RETURN NEW; END $$;
CREATE TRIGGER sanitize_teammates BEFORE INSERT OR UPDATE ON public.teammates FOR EACH ROW EXECUTE FUNCTION payiq_private.sanitize_team_row();
CREATE TRIGGER sanitize_team_records BEFORE INSERT OR UPDATE ON public.teammate_records FOR EACH ROW EXECUTE FUNCTION payiq_private.sanitize_team_row();
CREATE TRIGGER sanitize_team_drafts BEFORE INSERT OR UPDATE ON public.teammate_builder_drafts FOR EACH ROW EXECUTE FUNCTION payiq_private.sanitize_team_row();
CREATE TRIGGER sanitize_team_audit BEFORE INSERT ON public.teammate_audit FOR EACH ROW EXECUTE FUNCTION payiq_private.sanitize_team_row();
CREATE FUNCTION payiq_private.immutable_team_audit() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN RAISE EXCEPTION 'Audit history is immutable'; END $$;
CREATE TRIGGER immutable_team_audit BEFORE UPDATE OR DELETE ON public.teammate_audit FOR EACH ROW EXECUTE FUNCTION payiq_private.immutable_team_audit();
CREATE FUNCTION payiq_private.invalidate_team_policy() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
UPDATE public.teammates SET version=version+1,status=CASE WHEN status='retired' THEN 'retired' ELSE 'configuring' END WHERE id IN (SELECT teammate_id FROM public.teammate_records WHERE kind='policy' AND data->>'policy_id'=NEW.id::text);
RETURN NEW; END $$;
CREATE TRIGGER invalidate_team_policy AFTER UPDATE ON public.payment_policies FOR EACH ROW EXECUTE FUNCTION payiq_private.invalidate_team_policy();