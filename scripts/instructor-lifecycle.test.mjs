import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

const admin='00000000-0000-4000-8000-000000000001';
const instructor='00000000-0000-4000-8000-000000000002';
const student='00000000-0000-4000-8000-000000000003';
const migration=await readFile(new URL('../supabase/migrations/20260920040000_instructor_lifecycle.sql',import.meta.url),'utf8');

async function database(){
 const db=new PGlite();
 await db.exec(`
 create role anon;create role authenticated;create schema auth;
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
 grant usage on schema public,auth to authenticated;
 create table auth.users(id uuid primary key,email text,invited_at timestamptz,email_confirmed_at timestamptz,
 encrypted_password text,deleted_at timestamptz,banned_until timestamptz);
 create table profiles(id uuid primary key,email text);
 create table roles(id uuid primary key default gen_random_uuid(),name text);
 create table user_roles(user_id uuid,role_id uuid,primary key(user_id,role_id));
 create function has_role(p text[]) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from user_roles ur join roles r on r.id=ur.role_id where ur.user_id=auth.uid() and r.name=any(p)) $$;
 create function has_permission(p text) returns boolean language sql stable security definer set search_path=public as $$
 select has_role(array['admin','super_admin']) $$;
 create table instructor_profiles(user_id uuid primary key,department text,nursing_specialty text,professional_title text,
 institution text,staff_id text,account_status text default 'active',permissions jsonb default '{}',
 updated_at timestamptz default now(),constraint instructor_profiles_account_status_check
 check(account_status in ('invitation_pending','active','suspended','deactivated','invitation_expired')));
 alter table instructor_profiles enable row level security;
 grant select,insert,update,delete on instructor_profiles to authenticated;
 create policy instructor_profiles_admin_or_own on instructor_profiles to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
 create table pending_invites(id uuid default gen_random_uuid(),email text,role_name text,status text,accepted_at timestamptz,expires_at timestamptz default now()+interval '1 day');
 create table admin_audit_logs(admin_id uuid,action text,target_table text,target_id uuid,details jsonb);
 insert into roles(name) values('admin'),('instructor'),('student');
 insert into profiles values('${admin}','admin@example.test'),('${instructor}','teacher@example.test'),('${student}','student@example.test');
 insert into auth.users(id,email,invited_at) select id,email,case when id='${instructor}' then now() end from profiles;
 insert into user_roles select '${admin}',id from roles where name='admin';
 insert into user_roles select '${instructor}',id from roles where name='instructor';
 insert into user_roles select '${student}',id from roles where name='student';
 insert into pending_invites(email,role_name,status) values('teacher@example.test','instructor','pending');
 `);
 await db.exec(migration);
 await db.exec('create trigger legacy_invite after insert on profiles for each row execute function handle_pending_invite();');
 return db;
}
async function actor(db,id){await db.exec(`reset role;select set_config('test.uid','${id}',false);set role authenticated;`);}
async function state(db){await db.exec('reset role');return (await db.query('select * from instructor_profiles')).rows[0];}

test('instructor lifecycle database and RLS',async t=>{
 const db=await database();
 try{
 await t.test('backfill uses Auth invite evidence without invented completion dates',async()=>{
  const p=await state(db);assert.equal(p.account_status,'invited');assert.equal(p.onboarding_completed_at,null);assert.equal(p.invitation_accepted_at,null);
 });
 await t.test('browser cannot mutate protected status or permission fields',async()=>{
  await actor(db,instructor);
  await assert.rejects(db.exec("update instructor_profiles set account_status='active'"),/permission denied/);
  await assert.rejects(db.exec("select save_instructor_profile('{\"permissions\":{\"admin\":true}}')"),/Only supported/);
 });
 await t.test('pending instructor cannot self-complete or edit a profile',async()=>{
  await actor(db,instructor);
  await assert.rejects(db.exec('select complete_instructor_onboarding()'),/not available/);
  await assert.rejects(db.exec("select save_instructor_profile('{\"department\":\"Nursing\"}')"),/not available/);
 });
 await t.test('trusted Auth confirmation transitions once and updates invitation ledger',async()=>{
  await db.exec(`reset role;update auth.users set email_confirmed_at=now(),encrypted_password='synthetic-not-a-password' where id='${instructor}';`);
  assert.equal((await state(db)).account_status,'onboarding');
  await db.exec(`update auth.users set email_confirmed_at=email_confirmed_at where id='${instructor}'`);
  assert.equal((await db.query("select count(*)::int n from admin_audit_logs where action='INSTRUCTOR_ONBOARDING_STARTED'")).rows[0].n,1);
  assert.equal((await db.query('select status from pending_invites')).rows[0].status,'accepted');
 });
 await t.test('completion requires professional fields',async()=>{
  await actor(db,instructor);await assert.rejects(db.exec('select complete_instructor_onboarding()'),/required professional/);
 });
 await t.test('profile completion needs no course, and retry creates one completion event',async()=>{
  await actor(db,instructor);
  await db.exec(`select save_instructor_profile('${JSON.stringify({department:'Nursing',nursing_specialty:'Adult health',professional_title:'Lecturer',institution:'Test college'})}');select complete_instructor_onboarding();select complete_instructor_onboarding();`);
  assert.equal((await state(db)).account_status,'active');
  assert.equal((await db.query("select count(*)::int n from admin_audit_logs where action='INSTRUCTOR_ONBOARDING_COMPLETED'")).rows[0].n,1);
 });
 await t.test('students cannot read profiles or mutate another instructor',async()=>{
  await actor(db,student);assert.equal((await db.query('select * from instructor_profiles')).rows.length,0);
  await assert.rejects(db.exec(`select save_instructor_profile('{}','${instructor}')`),/Not authorized/);
  await assert.rejects(db.exec(`select admin_set_instructor_status('${instructor}','disabled','Unauthorized')`),/Not authorized/);
 });
 await t.test('suspend preserves profile and rejects completion; reactivation requires completion',async()=>{
  await actor(db,admin);await db.exec(`select admin_set_instructor_status('${instructor}','suspended','Review requested')`);
  await actor(db,instructor);await assert.rejects(db.exec('select complete_instructor_onboarding()'),/not available/);
  await actor(db,admin);await db.exec(`select admin_set_instructor_status('${instructor}','onboarding','Review completed')`);
  assert.equal((await state(db)).department,'Nursing');assert.equal((await state(db)).account_status,'onboarding');
 });
 await t.test('disabled profile cannot be revived by Auth confirmation',async()=>{
  await actor(db,admin);await db.exec(`select admin_set_instructor_status('${instructor}','disabled','Account cancelled')`);
  await db.exec(`reset role;update auth.users set email_confirmed_at=null where id='${instructor}';update auth.users set email_confirmed_at=now() where id='${instructor}'`);
  assert.equal((await state(db)).account_status,'disabled');
 });
 await t.test('role assignment creates a profile once without activating it',async()=>{
  await db.exec(`reset role;insert into user_roles select '${student}',id from roles where name='instructor';insert into user_roles select '${student}',id from roles where name='instructor' on conflict do nothing;`);
  assert.equal((await db.query(`select account_status from instructor_profiles where user_id='${student}'`)).rows[0].account_status,'onboarding');
  assert.equal((await db.query("select count(*)::int n from admin_audit_logs where action='INSTRUCTOR_ROLE_ASSIGNED'")).rows[0].n,1);
 });
 await t.test('profile creation cannot accept an instructor invite or grant a cancelled role',async()=>{
  await db.exec(`reset role;
   insert into pending_invites(email,role_name,status) values('pending@example.test','instructor','pending'),('cancelled@example.test','admin','cancelled');
   insert into profiles values('00000000-0000-4000-8000-000000000004','pending@example.test'),('00000000-0000-4000-8000-000000000005','cancelled@example.test');`);
  assert.equal((await db.query("select count(*)::int n from user_roles where user_id in ('00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000005')")).rows[0].n,0);
  assert.equal((await db.query("select accepted_at from pending_invites where email='pending@example.test'")).rows[0].accepted_at,null);
 });
 await t.test('legacy non-instructor invitations still work',async()=>{
  await db.exec(`reset role;insert into pending_invites(email,role_name,status) values('legacy@example.test','student','pending');
   insert into profiles values('00000000-0000-4000-8000-000000000006','legacy@example.test');`);
  assert.equal((await db.query("select count(*)::int n from user_roles where user_id='00000000-0000-4000-8000-000000000006'")).rows[0].n,1);
 });
 }finally{await db.close();}
});
