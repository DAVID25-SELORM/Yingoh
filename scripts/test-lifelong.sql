-- Run against an isolated database with the application migrations applied.
-- Fixtures and mutations are rolled back. No email or other external requests.
begin;
create function pg_temp.assert_true(ok boolean,label text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; raise notice 'PASS: %',label; end $$;
create function pg_temp.expect_error(statement text,pattern text) returns void language plpgsql as $$
declare failed boolean:=false;
begin
 begin execute statement; exception when others then
   if SQLERRM not ilike '%'||pattern||'%' then raise exception 'Unexpected error: %',SQLERRM; end if;
   failed:=true;
 end;
 if not failed then raise exception 'Expected rejection: %',statement; end if;
 raise notice 'PASS: rejected %',pattern;
end $$;

insert into auth.users(id,email) values
 ('10000000-0000-0000-0000-000000000001','author@nf-test.invalid'),
 ('10000000-0000-0000-0000-000000000002','reviewer@nf-test.invalid'),
 ('10000000-0000-0000-0000-000000000003','learner@nf-test.invalid'),
 ('10000000-0000-0000-0000-000000000004','outsider@nf-test.invalid');
insert into public.profiles(id,email,full_name) select id,email,email from auth.users where email like '%@nf-test.invalid' on conflict(id) do nothing;
insert into public.user_roles(user_id,role_id) select '10000000-0000-0000-0000-000000000001',id from public.roles where name='admin';
insert into public.user_roles(user_id,role_id) select '10000000-0000-0000-0000-000000000002',id from public.roles where name='content_reviewer';
insert into public.subscriptions(user_id,plan_name,status,current_period_end) values('10000000-0000-0000-0000-000000000003','30-Day Pass','active',now()+interval '30 days');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
insert into public.learning_items(id,title,body,references_text,next_review_on,hours,kind)
 values('20000000-0000-0000-0000-000000000001','Test CPD','Non-clinical fixture lesson','Test reference',current_date+90,2,'cpd');
insert into public.learning_assessments(item_id,questions) values('20000000-0000-0000-0000-000000000001','[{"prompt":"Choose B","choices":["A","B"],"correct":1,"rationale":"Fixture answer B"}]');
update public.learning_items set status='in_review' where id='20000000-0000-0000-0000-000000000001';
select pg_temp.expect_error($q$update public.learning_items set status='published' where id='20000000-0000-0000-0000-000000000001'$q$,'independent');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
select pg_temp.expect_error($q$update public.learning_items set status='published',body='Changed during approval' where id='20000000-0000-0000-0000-000000000001'$q$,'draft');
update public.learning_items set status='published' where id='20000000-0000-0000-0000-000000000001';
select pg_temp.assert_true((select reviewer_id=auth.uid() and version=3 from public.learning_items where id='20000000-0000-0000-0000-000000000001'),'independent review and version history');
select pg_temp.expect_error($q$update public.learning_assessments set questions='[]' where item_id='20000000-0000-0000-0000-000000000001'$q$,'draft');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',true);
select pg_temp.assert_true((select count(*)=0 from public.learning_assessments),'learners cannot read answer keys');
select pg_temp.assert_true(not ((public.learning_questions('20000000-0000-0000-0000-000000000001')->0)?'correct'),'question delivery strips answers');
select pg_temp.expect_error($q$select public.submit_learning_assessment('20000000-0000-0000-0000-000000000001',2,'[1]')$q$,'changed');
select pg_temp.assert_true(not (public.submit_learning_assessment('20000000-0000-0000-0000-000000000001',3,'[0]')->>'passed')::boolean,'wrong answer fails');
select pg_temp.assert_true((select count(*)=0 from public.learning_completions),'failed assessment awards no completion');
select pg_temp.assert_true((public.submit_learning_assessment('20000000-0000-0000-0000-000000000001',3,'[1]')->>'passed')::boolean,'correct answer passes');
select public.submit_learning_assessment('20000000-0000-0000-0000-000000000001',3,'[1]');
select pg_temp.assert_true((select count(*)=1 from public.cpd_records),'repeated passing submission awards credit once');
select pg_temp.assert_true((select count(*)=1 from public.user_certificates),'Basic subscriber can access earned certificate');
select pg_temp.assert_true((select count(*)=1 from public.transcript_records),'completion writes transcript');
select pg_temp.expect_error($q$insert into public.cpd_records(title,source,completed_on) values('Forged','platform',current_date)$q$,'row-level security');
select pg_temp.expect_error($q$insert into public.learning_completions(user_id,item_id,version,score) values(auth.uid(),'20000000-0000-0000-0000-000000000001',99,100)$q$,'permission denied');
insert into public.learning_profiles(user_id,daily_email) values(auth.uid(),false);
reset role;
select pg_temp.assert_true(not exists(select 1 from public.list_daily_question_recipients() where user_id='10000000-0000-0000-0000-000000000003'),'email preference is honored');
update public.subscriptions set current_period_end=now()-interval '1 day' where user_id='10000000-0000-0000-0000-000000000003';
set local role authenticated;
select pg_temp.expect_error($q$select public.learning_questions('20000000-0000-0000-0000-000000000001')$q$,'subscription');
select pg_temp.assert_true((select count(*)=1 from public.user_certificates),'expired subscribers retain certificates');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000004',true);
select pg_temp.assert_true((select count(*)=0 from public.cpd_records),'other learners cannot read CPD records');
select pg_temp.assert_true((select count(*)=0 from public.learning_completions),'other learners cannot read completions');
reset role;
insert into public.institution_accounts(id,name) values('30000000-0000-0000-0000-000000000001','Test Hospital A'),('30000000-0000-0000-0000-000000000002','Test Hospital B');
insert into public.competency_memberships(institution_id,user_id,role,display_name) values
 ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','assessor','Test Assessor'),
 ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','staff','Test Learner'),
 ('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000004','manager','Other Manager');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
insert into public.learning_items(id,title,kind,body,references_text,next_review_on) values('20000000-0000-0000-0000-000000000002','Test competency','competency','Observed assessment criteria','Test source',current_date+90);
update public.learning_items set status='in_review' where id='20000000-0000-0000-0000-000000000002';
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
update public.learning_items set status='published' where id='20000000-0000-0000-0000-000000000002';
select public.assign_competency('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002',current_date+7) as assignment_id \gset
select set_config('nf.test_assignment',:'assignment_id',true);
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000004',true);
select pg_temp.assert_true((select count(*)=0 from public.competency_assignments),'other hospital manager cannot see assignment');
select pg_temp.expect_error($q$select public.assess_competency(current_setting('nf.test_assignment')::uuid,true,'Unauthorized assessment',current_date+365)$q$,'independent');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',true);
select public.submit_competency_evidence(:'assignment_id','Observed practice evidence without patient data');
select pg_temp.expect_error($q$select public.assess_competency(current_setting('nf.test_assignment')::uuid,true,'Self assessment attempt',current_date+365)$q$,'independent');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
select public.assess_competency(:'assignment_id',true,'Direct observation met all assessment criteria',current_date+365);
select pg_temp.assert_true((select status='competent' and certificate_id is not null from public.competency_assignments where id=:'assignment_id'),'independent sign-off issues competency certificate');
select pg_temp.expect_error($q$select public.assess_competency(current_setting('nf.test_assignment')::uuid,true,'Repeat assessment attempt',current_date+365)$q$,'submitted');
reset role;
select pg_temp.assert_true((select count(*)=2 from public.learning_item_versions where item_id='20000000-0000-0000-0000-000000000001'),'revision history retained');
-- General subscriber sessions are open to Basic; private course sessions still require enrollment.
update public.subscriptions set current_period_end=now()+interval '30 days' where user_id='10000000-0000-0000-0000-000000000003';
insert into public.courses(id,title) values('40000000-0000-0000-0000-000000000001','Private fixture course');
insert into public.class_schedules(id,instructor_id,course_id,title,starts_at,ends_at) values
 ('50000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',null,'General test live class',now(),now()+interval '1 hour'),
 ('50000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','Private test live class',now(),now()+interval '1 hour');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',true);
select pg_temp.assert_true((select count(*)=1 from public.class_schedules where id::text like '50000000-%'),'Basic sees general but not private classes');
select pg_temp.assert_true((select count(*)=1 from public.join_live_session('50000000-0000-0000-0000-000000000001')),'Basic can join a general class');
select pg_temp.expect_error($q$select public.join_live_session('50000000-0000-0000-0000-000000000002')$q$,'eligible');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000004',true);
select pg_temp.expect_error($q$select public.join_live_session('50000000-0000-0000-0000-000000000001')$q$,'eligible');
reset role;
insert into public.course_memberships(course_id,user_id,status) values('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000004','enrolled');
set local role authenticated;
select pg_temp.assert_true((select count(*)=1 from public.join_live_session('50000000-0000-0000-0000-000000000002')),'private course enrollment still permits attendance');
select pg_temp.assert_true(not has_function_privilege('authenticated','public.queue_learning_reminders()','EXECUTE'),'learners cannot execute the reminder worker');
reset role;
insert into public.cpd_records(user_id,title,completed_on,expires_on) values('10000000-0000-0000-0000-000000000003','External fixture renewal',current_date-30,current_date+7);
select public.queue_learning_reminders();
select public.queue_learning_reminders();
select pg_temp.assert_true((select count(*)=1 from public.notifications where message like 'External fixture renewal%'),'reminders are idempotent');
select set_config('nf.test_cert',(select verification_code from public.user_certificates where title='Test CPD'),true);
set local role anon;
select pg_temp.assert_true((select is_verified from public.verify_certificate(current_setting('nf.test_cert'))),'certificate verification works without signing in');
reset role;
update public.user_certificates set status='revoked' where verification_code=current_setting('nf.test_cert');
set local role anon;
select pg_temp.assert_true((select not is_verified from public.verify_certificate(current_setting('nf.test_cert'))),'revoked certificate fails public verification');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
insert into public.learning_items(id,title,body,references_text,next_review_on,kind) values('20000000-0000-0000-0000-000000000003','Edited review fixture','Original','Fixture source',current_date+90,'competency');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
update public.learning_items set body='Reviewer edited criteria' where id='20000000-0000-0000-0000-000000000003';
update public.learning_items set status='in_review' where id='20000000-0000-0000-0000-000000000003';
select pg_temp.expect_error($q$update public.learning_items set status='published' where id='20000000-0000-0000-0000-000000000003'$q$,'independent');
reset role;
rollback;
