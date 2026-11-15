CREATE OR REPLACE FUNCTION public.complete_teammate_work(p_owner uuid,p_team uuid,p_action text,p_version integer,p_data jsonb) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE t public.teammates; rid uuid;
BEGIN
IF current_user<>'service_role' THEN RAISE EXCEPTION 'Server only'; END IF;
SELECT * INTO t FROM public.teammates WHERE id=p_team AND user_id=p_owner FOR UPDATE;
IF NOT FOUND THEN RAISE EXCEPTION 'Teammate not found'; END IF;
IF t.version<>p_version THEN RAISE EXCEPTION 'Configuration changed; retry'; END IF;
IF p_action='evaluate' THEN
 UPDATE public.teammates SET evaluated_version=p_version,evaluation=p_data,status=CASE WHEN status='active' THEN 'active' ELSE 'configuring' END WHERE id=t.id AND status<>'retired';
ELSIF p_action='document' THEN
 UPDATE public.teammate_records SET data=data||p_data WHERE id=(p_data->>'record_id')::uuid AND teammate_id=t.id AND kind='document';
 UPDATE public.teammates SET version=version+1,status='configuring' WHERE id=t.id;
ELSIF p_action IN ('complete','failed') THEN
 rid:=(p_data->>'run_id')::uuid;
 IF NOT EXISTS(SELECT 1 FROM public.teammate_records WHERE id=rid AND teammate_id=t.id AND kind='run') THEN RAISE EXCEPTION 'Run not found'; END IF;
 IF p_action='complete' AND (t.status<>'active' OR t.kill_switch OR EXISTS(SELECT 1 FROM public.teammate_owner_controls WHERE user_id=p_owner AND stopped)) THEN
 UPDATE public.teammate_records SET data=data||'{"status":"cancelled"}' WHERE id=rid;
 ELSE
 UPDATE public.teammate_records SET data=data||jsonb_build_object('status',CASE WHEN p_action='failed' THEN 'failed' ELSE 'completed' END,'outcome',p_data->>'outcome','summary',p_data->>'summary') WHERE id=rid;
 IF p_action='complete' THEN INSERT INTO public.teammate_records(user_id,teammate_id,kind,data) VALUES(p_owner,t.id,'message',jsonb_build_object('role','ai','text',p_data->>'reply','run_id',rid)); END IF;
 IF p_data->>'handoff' IN ('human','iq') THEN INSERT INTO public.teammate_records(user_id,teammate_id,kind,data) VALUES(p_owner,t.id,'handoff',jsonb_build_object('to',p_data->>'handoff','status','open','run_id',rid,'message',p_data->>'summary')); END IF;
 IF p_data->>'blocked' IS NOT NULL THEN INSERT INTO public.teammate_records(user_id,teammate_id,kind,data) VALUES(p_owner,t.id,'approval',jsonb_build_object('status','blocked','run_id',rid,'check',p_data->>'blocked','money_execution_available',false)); END IF;
 END IF;
ELSE RAISE EXCEPTION 'Invalid completion'; END IF;
INSERT INTO public.teammate_audit(user_id,teammate_id,actor_id,action,outcome,summary) VALUES(p_owner,t.id,p_owner,p_action,coalesce(p_data->>'outcome',p_data->>'status','recorded'),jsonb_build_object('run_id',rid,'check',p_data->>'blocked'));
END $$;
REVOKE ALL ON FUNCTION public.complete_teammate_work(uuid,uuid,text,integer,jsonb) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.complete_teammate_work(uuid,uuid,text,integer,jsonb) TO service_role;