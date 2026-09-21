import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const admin='00000000-0000-4000-8000-000000000001';
const student='00000000-0000-4000-8000-000000000002';
const other='00000000-0000-4000-8000-000000000003';
const plan='00000000-0000-4000-8000-000000000004';
const key='00000000-0000-4000-8000-000000000005';

test('access grant migration: authorization, RLS, audit, caps and retry invariants', async t=>{
 const db=new PGlite();
 try {
  await db.exec(`
   create role anon; create role authenticated; create role service_role;
   create schema auth;
   create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('test.uid',true),'')::uuid $$;
   grant usage on schema public,auth to authenticated;
   create table profiles(id uuid primary key);
   create table roles(id uuid primary key default gen_random_uuid(),name text);
   create table permissions(id text primary key,group_key text,label text);
   create table role_permissions(role_id uuid,permission_id text,primary key(role_id,permission_id));
   create table user_roles(user_id uuid,role_id uuid);
   create table payment_plans(id uuid primary key,name text,is_active boolean);
   create table promo_codes(id uuid primary key);
   create table subscriptions(id uuid primary key,user_id uuid,plan_name text,status text,current_period_end timestamptz,created_at timestamptz default now());
   create function public.has_role(p_roles text[]) returns boolean language sql stable security definer set search_path=public as $$
    select exists(select 1 from user_roles u join roles r on r.id=u.role_id where u.user_id=auth.uid() and r.name=any(p_roles)) $$;
   create function public.has_permission(p_permission text) returns boolean language sql stable security definer set search_path=public as $$
    select exists(select 1 from user_roles u join role_permissions r on r.role_id=u.role_id
     where u.user_id=auth.uid() and r.permission_id=p_permission) $$;
   insert into profiles values('${admin}'),('${student}'),('${other}');
   insert into roles(name) values('admin'),('super_admin'),('student');
   insert into user_roles select '${admin}',id from roles where name='admin';
   insert into user_roles select '${student}',id from roles where name='student';
   insert into payment_plans values('${plan}','180-Day Master Plan',true);
   insert into subscriptions(id,user_id,plan_name,status,current_period_end) values(gen_random_uuid(),'${student}','365-Day Faculty Pass','active',now()+interval '365 days');
  `);
  await db.exec(await readFile(new URL('../supabase/migrations/20260919200000_access_grant_foundation.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20260919210000_access_entitlement_adapters.sql',import.meta.url),'utf8'));
  const paid=(await db.query('select * from subscriptions')).rows;
  const login=async id=>{ await db.exec('reset role'); await db.query("select set_config('test.uid',$1,false)",[id]); await db.exec('set role authenticated'); };
  const dates=(await db.query("select now()::text as start,(now()+interval '30 days')::text as finish")).rows[0];
  const args=[student,plan,dates.start,dates.finish,'Scholarship','Private note',key,null];
  const create=values=>db.query('select admin_grant_access($1,$2,$3,$4,$5,$6,$7,$8) as id',values);
  let grant;
  await t.test('student cannot grant or mutate tables',async()=>{
   await login(student);
   await assert.rejects(create(args),/Not authorized/);
   await assert.rejects(db.query("insert into access_grants(id) values(gen_random_uuid())"),/permission denied/);
  });
  await t.test('admin grants 30 days with one audit event',async()=>{
   await login(admin); grant=(await create(args)).rows[0].id;
   assert.equal((await db.query('select action from access_grant_events')).rows[0].action,'ACCESS_GRANTED');
  });
  await t.test('identical retry returns same grant; altered payload rejected',async()=>{
   await db.exec("set timezone='America/New_York'");
   assert.equal((await create(args)).rows[0].id,grant);
   await db.exec("set timezone='UTC'");
   await assert.rejects(create(args.map((v,i)=>i===4?'Different':v)),/Idempotency conflict/);
   assert.equal((await db.query('select count(*)::int as n from access_grant_events')).rows[0].n,1);
  });
  await t.test('overlap and cumulative admin limit rejected',async()=>{
   await assert.rejects(create(args.map((v,i)=>i===6?other:v)),/Overlapping/);
   const extension=[student,plan,dates.finish,new Date(Date.parse(dates.finish)+86400000).toISOString(),'Extend',null,other,grant];
   await assert.rejects(create(extension),/Admin duration limit/);
  });
  await t.test('student sees safe own summary, no internal or other-account rows',async()=>{
   await login(student);
   assert.deepEqual((await db.query('select * from access_grants')).rows,[]);
   assert.deepEqual((await db.query('select * from access_grant_events')).rows,[]);
   const summary=(await db.query('select * from my_access_grant_summary()')).rows;
   assert.equal(summary.length,1); assert.equal(summary[0].status,'active');
   assert.equal('internal_note' in summary[0],false); assert.equal('created_by' in summary[0],false);
   await login(other); assert.deepEqual((await db.query('select * from my_access_grant_summary()')).rows,[]);
  });
  await t.test('super-admin extension creates linked history and scheduled summary',async()=>{
   await db.exec('reset role');
   await db.exec(`insert into user_roles select '${admin}',id from roles where name='super_admin'`);
   await login(admin);
   const extension=[student,plan,dates.finish,new Date(Date.parse(dates.finish)+86400000).toISOString(),'Extend',null,other,grant];
   await create(extension);
   assert.equal((await db.query("select count(*)::int as n from access_grant_events where action='ACCESS_EXTENDED'")).rows[0].n,1);
   await login(student);
   assert.equal((await db.query("select count(*)::int as n from my_access_grant_summary() where status='scheduled'")).rows[0].n,1);
  });
  await t.test('revoke requires authority and reason; repeated revoke is audited once',async()=>{
   await assert.rejects(db.query('select admin_revoke_access($1,$2)',[grant,'Error']),/Not authorized/);
   await login(admin);
   await assert.rejects(db.query('select admin_revoke_access($1,$2)',[grant,' ']),/Reason required/);
   await db.query('select admin_revoke_access($1,$2)',[grant,'Granted in error']);
   await db.query('select admin_revoke_access($1,$2)',[grant,'Granted in error']);
   assert.equal((await db.query("select count(*)::int as n from access_grant_events where action='ACCESS_REVOKED'")).rows[0].n,1);
   await assert.rejects(db.query('delete from access_grant_events'),/permission denied/);
  });
  await t.test('paid subscriptions remain unchanged; anonymous RPC is forbidden',async()=>{
   await login(student);
   assert.equal((await db.query("select my_effective_access()->>'source' as source")).rows[0].source,'paid_subscription');
   assert.equal((await db.query('select current_subscription_plan_key() as plan')).rows[0].plan,'faculty');
   assert.equal((await db.query('select current_question_access_level() as level')).rows[0].level,3);
   await db.exec('reset role'); assert.deepEqual((await db.query('select * from subscriptions')).rows,paid);
   await db.exec('set role anon'); await assert.rejects(create(args),/permission denied/);
  });
  await t.test('resolver rejects scheduled, expired and revoked grants without cron',async()=>{
   await db.exec('reset role');
   // Local synthetic fixture only. No live subscriptions are changed.
   await db.exec('delete from subscriptions');
   await login(student);
   assert.equal((await db.query("select my_effective_access()->>'has_access' as allowed")).rows[0].allowed,'false');
   assert.equal((await db.query('select current_subscription_plan_key() as plan')).rows[0].plan,'free');
   assert.equal((await db.query('select has_daily_question_access() as allowed')).rows[0].allowed,false);
   await db.exec('reset role');
   await db.exec("update access_grants set starts_at=now()-interval '2 days',expires_at=now()-interval '1 day' where revoked_at is null");
   await login(student);
   assert.equal((await db.query("select my_effective_access()->>'has_access' as allowed")).rows[0].allowed,'false');
   await db.exec('reset role');
   await db.exec("update access_grants set starts_at=now()-interval '1 day',expires_at=now()+interval '1 day',status='scheduled' where revoked_at is null");
   await login(student);
   assert.equal((await db.query("select my_effective_access()->>'source' as source")).rows[0].source,'manual_extension');
   assert.equal((await db.query('select current_subscription_plan_key() as plan')).rows[0].plan,'master');
   assert.equal((await db.query('select current_question_access_level() as level')).rows[0].level,3);
   assert.equal((await db.query('select has_daily_question_access() as allowed')).rows[0].allowed,true);
  });
  await t.test('paid basic tier wins over master grant and expired newer payments',async()=>{
   await db.exec('reset role');
   await db.exec(`insert into subscriptions values(gen_random_uuid(),'${student}','30-Day Pass','active',now()+interval '1 day',now()-interval '1 day'),
    (gen_random_uuid(),'${student}','365-Day Faculty Pass','active',now()-interval '1 day',now());`);
   await login(student);
   assert.equal((await db.query('select current_subscription_plan_key() as plan')).rows[0].plan,'basic');
   assert.equal((await db.query('select current_question_access_level() as level')).rows[0].level,2);
  });
  await t.test('server rollout controls default off and cannot be changed by clients',async()=>{
   await db.exec('reset role');
   await db.exec(await readFile(new URL('../supabase/migrations/20260919220000_access_server_controls.sql',import.meta.url),'utf8'));
   await login(admin);
   assert.deepEqual((await db.query('select * from access_system_controls')).rows,[{
    id:true,complimentary_access_enabled:false,promo_codes_enabled:false,hubtel_payments_enabled:false,
   }]);
   await assert.rejects(db.query('update access_system_controls set complimentary_access_enabled=true'),/permission denied/);
   await assert.rejects(create([other,plan,dates.start,dates.finish,'Disabled',null,plan,null]),/Complimentary access is disabled/);
  });
  await t.test('paused grant access preserves paid access and revocation remains available',async()=>{
   await login(student);
   assert.equal((await db.query('select current_subscription_plan_key() as plan')).rows[0].plan,'basic');
   await db.exec('reset role');
   await db.exec('delete from subscriptions');
   await login(student);
   assert.equal((await db.query('select current_subscription_plan_key() as plan')).rows[0].plan,'free');
   await db.exec('reset role');
   await db.exec('update access_system_controls set complimentary_access_enabled=true');
   await login(student);
   assert.equal((await db.query('select current_subscription_plan_key() as plan')).rows[0].plan,'master');
   await db.exec('reset role');
   await db.exec('update access_system_controls set complimentary_access_enabled=false');
   await login(admin);
   const extension=(await db.query('select id from access_grants where parent_grant_id=$1',[grant])).rows[0].id;
   await db.query('select admin_revoke_access($1,$2)',[extension,'Revoked while paused']);
   assert.equal((await db.query('select status from access_grants where id=$1',[extension])).rows[0].status,'revoked');
  });
  await t.test('bulk preview is read-only and classifies invalid, unknown, duplicate and paid users',async()=>{
   await db.exec('reset role');
   await db.exec(`alter table profiles add column email text,add column full_name text;
    update profiles set email=id::text||'@example.test',full_name='Fixture';
    create table notifications(id uuid default gen_random_uuid(),user_id uuid,title text,message text,type text,link text);
    create table admin_audit_logs(id uuid default gen_random_uuid(),admin_id uuid,action text,target_table text,target_id uuid,details jsonb);
    insert into subscriptions values(gen_random_uuid(),'${student}','30-Day Pass','active',now()+interval '1 day',now());`);
   await db.exec(await readFile(new URL('../supabase/migrations/20260919230000_bulk_access_grants.sql',import.meta.url),'utf8'));
   await db.exec(await readFile(new URL('../supabase/migrations/20260920000000_access_reporting_notifications.sql',import.meta.url),'utf8'));
   await login(student);
   await assert.rejects(db.query('select admin_preview_bulk_access($1)',[[other]]),/Not authorized/);
   await login(admin);
   const entries=[other+'@example.test',other,'invalid','unknown@example.test',student];
   const before=(await db.query('select count(*)::int as n from access_grants')).rows[0].n;
   const preview=(await db.query('select admin_preview_bulk_access($1) as result',[entries])).rows[0].result;
   assert.equal(preview.summary.submitted,5); assert.equal(preview.summary.eligible,1);
   assert.equal(preview.summary.duplicates,1); assert.equal(preview.summary.invalid,1);
   assert.equal(preview.summary.unknown,1); assert.equal(preview.summary.paid,1);
   assert.equal((await db.query('select count(*)::int as n from access_grants')).rows[0].n,before);
   assert.equal((await db.query('select count(*)::int as n from access_grant_batches')).rows[0].n,0);
   await assert.rejects(db.query('select admin_preview_bulk_access($1)',[Array(101).fill(other)]),/between 1 and 100/);
  });
  await t.test('confirmed bulk execution is idempotent, notifies once and retains batch audit',async()=>{
   const entries=[other];
   const preview=(await db.query('select admin_preview_bulk_access($1) as result',[entries])).rows[0].result;
   const args=[entries,plan,dates.start,dates.finish,'Bulk fixture',null,true,'00000000-0000-4000-8000-000000000099',preview.preview_hash];
   const run=values=>db.query('select admin_execute_bulk_access($1,$2,$3,$4,$5,$6,$7,$8,$9) as result',values);
   await assert.rejects(run(args),/Complimentary access is disabled/);
   await db.exec('reset role'); await db.exec('update access_system_controls set complimentary_access_enabled=true'); await login(admin);
   await assert.rejects(run(args.map((v,i)=>i===8?'stale':v)),/Preview changed/);
   const first=(await run(args)).rows[0].result;
   const second=(await run(args)).rows[0].result;
   assert.deepEqual(second,first); assert.equal(first.grant_ids.length,1);
   await assert.rejects(run(args.map((v,i)=>i===4?'Different':v)),/Idempotency conflict/);
   await db.exec('reset role');
   assert.equal((await db.query('select count(*)::int as n from notifications')).rows[0].n,1);
   assert.equal((await db.query("select count(*)::int as n from admin_audit_logs where action='BULK_ACCESS_GRANTED'")).rows[0].n,1);
  });
  await t.test('reporting requires staff permission, paginates and excludes request payloads',async()=>{
   await login(student);
   await assert.rejects(db.query('select admin_access_grants()'),/Not authorized/);
   await assert.rejects(db.query('select admin_access_history()'),/Not authorized/);
   await assert.rejects(db.query('select admin_access_users($1)',['Fixture']),/Not authorized/);
   await login(admin);
   const report=(await db.query('select admin_access_grants() as result')).rows[0].result;
   assert.ok(report.total>0); assert.ok(report.rows.length<=25);
   assert.equal('request_payload' in report.rows[0],false);
   assert.equal('request_key' in report.rows[0],false);
   const filtered=(await db.query("select admin_access_grants(p_status=>'revoked') as result")).rows[0].result;
   assert.ok(filtered.rows.every(row=>row.effective_status==='revoked'));
   const history=(await db.query('select admin_access_history() as result')).rows[0].result;
   assert.ok(history.total>0); assert.equal('request_payload' in history.rows[0].new_values,false);
   assert.equal((await db.query('select admin_access_users($1)',[other+'@example.test'])).rows.length,1);
   await assert.rejects(db.query('select admin_access_grants(p_page=>-1)'),/Invalid filter/);
  });
  await t.test('individual grant and revoke notices are atomic and idempotent',async()=>{
   await login(admin);
   const args=[student,plan,dates.start,dates.finish,'Individual notification',null,'00000000-0000-4000-8000-000000000777',true,null];
   const issue=values=>db.query('select admin_issue_access($1,$2,$3,$4,$5,$6,$7,$8,$9) as id',values);
   const first=(await issue(args)).rows[0].id;
   assert.equal((await issue(args)).rows[0].id,first);
   await assert.rejects(issue(args.map((v,i)=>i===7?false:v)),/Notification request conflict/);
   await db.query('select admin_revoke_access_with_notice($1,$2,$3)',[first,'Ended',true]);
   await db.query('select admin_revoke_access_with_notice($1,$2,$3)',[first,'Ended',true]);
   await db.exec('reset role');
   assert.equal((await db.query('select count(*)::int as n from notifications')).rows[0].n,3);
   assert.equal((await db.query("select count(*)::int as n from access_grant_events where access_grant_id=$1",[first])).rows[0].n,2);
  });
  await t.test('reminders are service-only, paused safely and delivered once per expiry stage',async()=>{
   await login(admin);
   await assert.rejects(db.query('select process_access_reminders()'),/permission denied/);
   await assert.rejects(db.query("select emit_access_notice($1,'forged','x','x',true)",[student]),/permission denied/);
   await db.exec('reset role');
   await db.query("update access_grants set expires_at=now()+interval '6 days' where user_id=$1 and revoked_at is null",[other]);
   await db.exec('update access_system_controls set complimentary_access_enabled=false; set role service_role');
   assert.equal((await db.query('select process_access_reminders() as n')).rows[0].n,0);
   await db.exec('reset role; update access_system_controls set complimentary_access_enabled=true; set role service_role');
   assert.equal((await db.query('select process_access_reminders() as n')).rows[0].n,1);
   assert.equal((await db.query('select process_access_reminders() as n')).rows[0].n,0);
   await db.exec('reset role; delete from notifications; set role service_role');
   assert.equal((await db.query('select process_access_reminders() as n')).rows[0].n,0);
   for(const period of ["2 days","12 hours","-1 hour"]){
    await db.exec('reset role');
    await db.query("update access_grants set starts_at=now()-interval '30 days',expires_at=now()+$1::interval where user_id=$2 and revoked_at is null",[period,other]);
    await db.exec('set role service_role');
    assert.equal((await db.query('select process_access_reminders() as n')).rows[0].n,1);
    assert.equal((await db.query('select process_access_reminders() as n')).rows[0].n,0);
   }
   await db.exec('reset role');
   assert.equal((await db.query('select count(*)::int as n from notifications')).rows[0].n,3);
  });
 } finally { await db.close(); }
});
