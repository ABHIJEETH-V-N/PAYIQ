CREATE TABLE public.teammates(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.profiles(id), name text NOT NULL, role text NOT NULL, goal text NOT NULL, spec jsonb NOT NULL, status text NOT NULL DEFAULT 'configuring' CHECK(status IN ('configuring','ready','active','paused','retired')), kill_switch boolean NOT NULL DEFAULT false, version integer NOT NULL DEFAULT 1, evaluated_version integer, evaluation jsonb, retired_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,user_id));
GRANT SELECT ON public.teammates TO authenticated; GRANT ALL ON public.teammates TO service_role;
ALTER TABLE public.teammates ENABLE ROW LEVEL SECURITY;
CREATE POLICY teams_read ON public.teammates FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
CREATE TRIGGER teams_touch BEFORE UPDATE ON public.teammates FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TABLE public.teammate_records(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, teammate_id uuid NOT NULL, kind text NOT NULL CHECK(kind IN ('scope','document','connection','policy','message','run','approval','grievance','handoff','job')), data jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(teammate_id,user_id) REFERENCES public.teammates(id,user_id));
GRANT SELECT ON public.teammate_records TO authenticated; GRANT ALL ON public.teammate_records TO service_role;
ALTER TABLE public.teammate_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY team_records_read ON public.teammate_records FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
CREATE INDEX team_records_lookup ON public.teammate_records(teammate_id,kind,created_at);
CREATE TRIGGER team_records_touch BEFORE UPDATE ON public.teammate_records FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TABLE public.teammate_audit(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.profiles(id), teammate_id uuid REFERENCES public.teammates(id), actor_id uuid NOT NULL, action text NOT NULL, outcome text NOT NULL, summary jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.teammate_audit TO authenticated; GRANT SELECT,INSERT ON public.teammate_audit TO service_role;
ALTER TABLE public.teammate_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY team_audit_read ON public.teammate_audit FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
CREATE TABLE public.teammate_owner_controls(user_id uuid PRIMARY KEY REFERENCES public.profiles(id), stopped boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.teammate_owner_controls TO authenticated; GRANT ALL ON public.teammate_owner_controls TO service_role;
ALTER TABLE public.teammate_owner_controls ENABLE ROW LEVEL SECURITY;
CREATE POLICY team_controls_read ON public.teammate_owner_controls FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
CREATE TABLE public.teammate_builder_drafts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.profiles(id), data jsonb NOT NULL, expires_at timestamptz NOT NULL DEFAULT now()+interval '24 hours', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,INSERT,UPDATE,DELETE ON public.teammate_builder_drafts TO authenticated; GRANT ALL ON public.teammate_builder_drafts TO service_role;
ALTER TABLE public.teammate_builder_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY team_drafts_owner ON public.teammate_builder_drafts FOR ALL TO authenticated USING(user_id=(SELECT auth.uid())) WITH CHECK(user_id=(SELECT auth.uid()) AND expires_at<=now()+interval '24 hours');
CREATE TRIGGER team_drafts_touch BEFORE UPDATE ON public.teammate_builder_drafts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE OR REPLACE FUNCTION public.teammate_action(p_action text,p_id uuid DEFAULT NULL,p_data jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE uid uuid:=auth.uid(); t public.teammates; rid uuid; sc text; result jsonb:='{}';
BEGIN
IF uid IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
INSERT INTO public.teammate_owner_controls(user_id) VALUES(uid) ON CONFLICT DO NOTHING;
PERFORM 1 FROM public.teammate_owner_controls WHERE user_id=uid FOR UPDATE;
IF p_action='create' THEN
 IF length(trim(p_data->>'name')) NOT BETWEEN 1 AND 80 OR length(trim(p_data->>'goal')) NOT BETWEEN 1 AND 2000 OR p_data->>'role' NOT IN ('refunds','collections','support','sales','settlement','custom') THEN RAISE EXCEPTION 'Invalid teammate profile'; END IF;
 INSERT INTO public.teammates(user_id,name,role,goal,spec) VALUES(uid,p_data->>'name',p_data->>'role',p_data->>'goal',p_data) RETURNING * INTO t;
 FOR result IN SELECT value FROM jsonb_array_elements(coalesce(p_data->'documents_needed','[]')) LOOP
 INSERT INTO public.teammate_records(user_id,teammate_id,kind,data) VALUES(uid,t.id,'document',result||'{"status":"requested"}'); END LOOP;
 result:=jsonb_build_object('id',t.id);
ELSIF p_action='stop_all' THEN
 UPDATE public.teammate_owner_controls SET stopped=true,updated_at=now() WHERE user_id=uid;
 UPDATE public.teammates SET status='paused',kill_switch=true WHERE user_id=uid AND status<>'retired';
 UPDATE public.teammate_records SET data=data||'{"status":"cancelled"}' WHERE user_id=uid AND kind IN ('job','run') AND data->>'status' IN ('queued','running');
ELSE
 SELECT * INTO t FROM public.teammates WHERE id=p_id AND user_id=uid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Teammate not found'; END IF;
 IF t.status='retired' AND p_action<>'restore' THEN RAISE EXCEPTION 'Teammate retired'; END IF;
 CASE p_action
 WHEN 'pause' THEN
 UPDATE public.teammates SET status='paused',kill_switch=true WHERE id=t.id;
 UPDATE public.teammate_records SET data=data||'{"status":"cancelled"}' WHERE teammate_id=t.id AND kind IN ('job','run') AND data->>'status' IN ('queued','running');
 WHEN 'retire' THEN UPDATE public.teammates SET status='retired',kill_switch=true,retired_at=now() WHERE id=t.id;
 WHEN 'restore' THEN
 IF t.retired_at IS NULL OR t.retired_at<now()-interval '30 days' THEN RAISE EXCEPTION 'Recovery period ended'; END IF;
 UPDATE public.teammates SET status='configuring',kill_switch=true,retired_at=NULL WHERE id=t.id;
 WHEN 'rename' THEN
 IF length(trim(p_data->>'name')) NOT BETWEEN 1 AND 80 THEN RAISE EXCEPTION 'Enter a name'; END IF;
 UPDATE public.teammates SET name=trim(p_data->>'name') WHERE id=t.id;
 WHEN 'grant' THEN
 sc:=p_data->>'scope';
 IF sc NOT IN ('read:transactions','read:documents','write:message','write:ticket','write:reversal','write:refund') THEN RAISE EXCEPTION 'Scope not grantable'; END IF;
 IF length(trim(coalesce(p_data->>'purpose','')))=0 OR length(trim(coalesce(p_data->>'categories','')))=0 THEN RAISE EXCEPTION 'Purpose and data categories required'; END IF;
 IF sc IN ('write:refund','write:reversal') AND (coalesce((p_data->>'limit_per_action_paise')::bigint,0)<=0 OR coalesce((p_data->>'daily_cap_paise')::bigint,0)<=0 OR p_data->>'approval' NOT IN ('always','above_limit')) THEN RAISE EXCEPTION 'Money scopes require limits and approval'; END IF;
 INSERT INTO public.teammate_records(user_id,teammate_id,kind,data) VALUES(uid,t.id,'scope',p_data||jsonb_build_object('granted_by',uid,'expires_at',now()+interval '90 days','revoked',false)) RETURNING id INTO rid;
 INSERT INTO public.teammate_audit(user_id,teammate_id,actor_id,action,outcome,summary) VALUES(uid,t.id,uid,'consent.recorded','saved',jsonb_build_object('scope',sc,'purpose',p_data->>'purpose','categories',p_data->>'categories'));
 UPDATE public.teammates SET version=version+1,status='configuring' WHERE id=t.id;
 WHEN 'revoke' THEN
 UPDATE public.teammate_records SET data=data||'{"revoked":true}' WHERE id=(p_data->>'record_id')::uuid AND teammate_id=t.id AND kind='scope';
 UPDATE public.teammates SET version=version+1,status='configuring' WHERE id=t.id;
 WHEN 'renew' THEN
 UPDATE public.teammate_records SET data=data||jsonb_build_object('expires_at',now()+interval '90 days','revoked',false,'granted_by',uid) WHERE id=(p_data->>'record_id')::uuid AND teammate_id=t.id AND kind='scope';
 UPDATE public.teammates SET version=version+1,status='configuring' WHERE id=t.id;
 WHEN 'attach_policy' THEN
 IF NOT EXISTS(SELECT 1 FROM public.payment_policies WHERE id=(p_data->>'policy_id')::uuid AND user_id=uid) THEN RAISE EXCEPTION 'Policy not found'; END IF;
 INSERT INTO public.teammate_records(user_id,teammate_id,kind,data) VALUES(uid,t.id,'policy',jsonb_build_object('policy_id',p_data->>'policy_id','published',false));
 UPDATE public.teammates SET version=version+1,status='configuring' WHERE id=t.id;
 WHEN 'publish_policy' THEN
 UPDATE public.teammate_records SET data=data||'{"published":true}' WHERE id=(p_data->>'record_id')::uuid AND teammate_id=t.id AND kind='policy';
 UPDATE public.teammates SET version=version+1,status='configuring' WHERE id=t.id;
 WHEN 'detach_policy' THEN
 DELETE FROM public.teammate_records WHERE id=(p_data->>'record_id')::uuid AND teammate_id=t.id AND kind='policy';
 UPDATE public.teammates SET version=version+1,status='configuring' WHERE id=t.id;
 WHEN 'activate' THEN
 IF t.evaluated_version IS DISTINCT FROM t.version OR t.evaluation->>'passed' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Run and pass evaluation first'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.teammate_records WHERE teammate_id=t.id AND kind='scope' AND data->>'revoked'='false' AND (data->>'expires_at')::timestamptz>now()) THEN RAISE EXCEPTION 'Grant permissions first'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.teammate_records WHERE teammate_id=t.id AND kind='policy' AND data->>'published'='true') THEN RAISE EXCEPTION 'Publish an attached policy first'; END IF;
 IF EXISTS(SELECT 1 FROM public.teammate_records WHERE teammate_id=t.id AND kind='document' AND data->>'required'='true' AND data->>'status'<>'parsed') THEN RAISE EXCEPTION 'Required documents need parsing'; END IF;
 IF jsonb_array_length(coalesce(t.spec->'connections_needed','[]'))>0 THEN RAISE EXCEPTION 'Verified connection broker is required for this teammate'; END IF;
 UPDATE public.teammate_owner_controls SET stopped=false,updated_at=now() WHERE user_id=uid;
 UPDATE public.teammates SET status='active',kill_switch=false WHERE id=t.id;
 WHEN 'report' THEN
 INSERT INTO public.teammate_records(user_id,teammate_id,kind,data) VALUES(uid,t.id,'grievance',jsonb_build_object('run_id',p_data->>'run_id','message',p_data->>'message','owner',uid,'status','open','due_at',now()+interval '24 hours'));
 WHEN 'ask_human' THEN
 INSERT INTO public.teammate_records(user_id,teammate_id,kind,data) VALUES(uid,t.id,'handoff',jsonb_build_object('status','open','to','owner','message','Human help requested'));
 ELSE RAISE EXCEPTION 'Unsupported teammate action';
 END CASE;
END IF;
INSERT INTO public.teammate_audit(user_id,teammate_id,actor_id,action,outcome,summary) VALUES(uid,CASE WHEN p_action='stop_all' THEN NULL ELSE t.id END,uid,p_action,'saved',jsonb_build_object('record_id',rid));
RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.teammate_action(text,uuid,jsonb) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.teammate_action(text,uuid,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.teammate_runtime_write(p_id uuid,p_action text,p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE uid uuid:=auth.uid(); t public.teammates; rid uuid;
BEGIN
IF uid IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
SELECT * INTO t FROM public.teammates WHERE id=p_id AND user_id=uid FOR UPDATE;
IF NOT FOUND THEN RAISE EXCEPTION 'Teammate not found'; END IF;
IF p_action='begin' THEN
 IF t.status<>'active' OR t.kill_switch OR EXISTS(SELECT 1 FROM public.teammate_owner_controls WHERE user_id=uid AND stopped) THEN RAISE EXCEPTION 'Teammate is not active'; END IF;
 IF EXISTS(SELECT 1 FROM public.teammate_records WHERE teammate_id=t.id AND kind='run' AND data->>'status'='running' AND created_at>now()-interval '1 minute') THEN RAISE EXCEPTION 'A run is already in progress'; END IF;
 IF (SELECT count(*) FROM public.teammate_records WHERE teammate_id=t.id AND kind='run' AND created_at>now()-interval '1 minute')>=10 THEN RAISE EXCEPTION 'Rate limit reached'; END IF;
 INSERT INTO public.teammate_records(user_id,teammate_id,kind,data) VALUES(uid,t.id,'message',jsonb_build_object('role','user','text',p_data->>'text'));
 INSERT INTO public.teammate_records(user_id,teammate_id,kind,data) VALUES(uid,t.id,'run','{"status":"running"}') RETURNING id INTO rid;
 RETURN jsonb_build_object('run_id',rid);
ELSE RAISE EXCEPTION 'Server completion required'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.teammate_runtime_write(uuid,text,jsonb) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.teammate_runtime_write(uuid,text,jsonb) TO authenticated;