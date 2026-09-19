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
   create role anon; create role authenticated;
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
   await db.exec('reset role'); assert.deepEqual((await db.query('select * from subscriptions')).rows,paid);
   await db.exec('set role anon'); await assert.rejects(create(args),/permission denied/);
  });
  await t.test('resolver rejects scheduled, expired and revoked grants without cron',async()=>{
   await db.exec('reset role');
   // Local synthetic fixture only. No live subscriptions are changed.
   await db.exec('delete from subscriptions');
   await login(student);
   assert.equal((await db.query("select my_effective_access()->>'has_access' as allowed")).rows[0].allowed,'false');
   await db.exec('reset role');
   await db.exec("update access_grants set starts_at=now()-interval '2 days',expires_at=now()-interval '1 day' where revoked_at is null");
   await login(student);
   assert.equal((await db.query("select my_effective_access()->>'has_access' as allowed")).rows[0].allowed,'false');
   await db.exec('reset role');
   await db.exec("update access_grants set starts_at=now()-interval '1 day',expires_at=now()+interval '1 day',status='scheduled' where revoked_at is null");
   await login(student);
   assert.equal((await db.query("select my_effective_access()->>'source' as source")).rows[0].source,'manual_extension');
  });
 } finally { await db.close(); }
});
