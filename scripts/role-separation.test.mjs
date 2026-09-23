import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test, after } from 'node:test';

const db = new PGlite();
after(() => db.close());
const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const SUPER = uid(1), SUPER2 = uid(2), ADMIN = uid(3), ADMIN2 = uid(4), STUDENT = uid(5), TARGET = uid(6);

await db.exec(`
create role anon; create role authenticated; create role service_role bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
grant usage on schema auth to authenticated,service_role; grant usage on schema public to anon,authenticated,service_role;
create table roles(id uuid primary key default gen_random_uuid(),name text unique not null);
create table user_roles(user_id uuid not null,role_id uuid not null references roles(id),primary key(user_id,role_id));
create table pending_invites(id uuid primary key default gen_random_uuid(),email text unique,full_name text,role_name text,expires_at timestamptz,accepted_at timestamptz);
insert into roles(name) values('student'),('instructor'),('admin'),('super_admin'),('finance');
create function public.has_role(role_names text[]) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from user_roles ur join roles r on r.id=ur.role_id where ur.user_id=auth.uid() and r.name=any(role_names)) $$;
create function public.is_super_admin() returns boolean language sql stable security definer set search_path=public as $$ select public.has_role(array['super_admin']) $$;
insert into user_roles select u.id::uuid,r.id from (values('${SUPER}','super_admin'),('${SUPER2}','super_admin'),('${ADMIN}','admin'),('${ADMIN2}','admin'),('${STUDENT}','student'),('${TARGET}','student')) u(id,n) join roles r on r.name=u.n;
alter table pending_invites enable row level security;
grant select,insert,update,delete on pending_invites to authenticated;
create policy invites_admin_all on pending_invites for all to authenticated using(true) with check(true);
`);
await db.exec(await readFile(new URL('../supabase/migrations/20260922000000_restrict_privileged_role_management.sql', import.meta.url), 'utf8'));

const q = async (sql, args = []) => (await db.query(sql, args)).rows;
const as = async (who, fn) => {
  await db.exec(`reset role; set test.uid='${who}'; set role authenticated`);
  try { return await fn(); } finally { await db.exec('reset role'); }
};
const assign = (who, target, role) => as(who, () => q('select public.admin_assign_role($1,$2)', [target, role]));
const remove = (who, target, role) => as(who, () => q('select public.admin_remove_role($1,$2)', [target, role]));
const invite = (who, email, role) => as(who, () => q('select public.admin_invite_user($1,$2,$3)', [email, 'Name', role]));
const rolesOf = async id => (await q('select r.name from user_roles ur join roles r on r.id=ur.role_id where ur.user_id=$1 order by 1', [id])).map(r => r.name);

test('an ordinary admin can manage non-privileged roles', async () => {
  await assign(ADMIN, TARGET, 'instructor'); assert.deepEqual(await rolesOf(TARGET), ['instructor', 'student']);
  await remove(ADMIN, TARGET, 'instructor'); assert.deepEqual(await rolesOf(TARGET), ['student']);
  await assign(ADMIN, TARGET, 'finance'); await remove(ADMIN, TARGET, 'finance');
  await invite(ADMIN, 'ok@x.com', 'instructor');
  assert.equal((await q("select role_name from pending_invites where email='ok@x.com'"))[0].role_name, 'instructor');
});

test('an admin cannot grant or invite the privileged tier, or touch privileged accounts', async () => {
  await assert.rejects(assign(ADMIN, TARGET, 'admin'), /Only a Super Admin can assign the Admin role/);
  await assert.rejects(assign(ADMIN, TARGET, 'super_admin'), /Only a Super Admin can assign the Super Admin role/);
  await assert.rejects(assign(ADMIN, TARGET, ' ADMIN '), /Only a Super Admin can assign the Admin role/);
  await assert.rejects(invite(ADMIN, 'bad@x.com', 'admin'), /Only a Super Admin can invite an Admin/);
  await assert.rejects(invite(ADMIN, 'bad2@x.com', 'Super_Admin'), /Only a Super Admin can invite another Super Admin/);
  await assert.rejects(assign(ADMIN, ADMIN2, 'instructor'), /Only a Super Admin can modify an Admin account/);
  await assert.rejects(remove(ADMIN, ADMIN2, 'admin'), /Only a Super Admin can remove the Admin role/);
  await assert.rejects(remove(ADMIN, SUPER, 'super_admin'), /Only a Super Admin can remove the Super Admin role/);
  await assert.rejects(assign(ADMIN, SUPER, 'instructor'), /Only a Super Admin can modify a Super Admin account/);
  assert.deepEqual(await rolesOf(TARGET), ['student']); assert.deepEqual(await rolesOf(ADMIN2), ['admin']);
});

test('an admin cannot bypass the rule through the invites table directly', async () => {
  await assert.rejects(as(ADMIN, () => q("insert into pending_invites(email,role_name) values('direct@x.com','admin')")), /row-level security/);
  await as(ADMIN, () => q("insert into pending_invites(email,role_name) values('fine@x.com','student')"));
  await assert.rejects(as(ADMIN, () => q("update pending_invites set role_name='super_admin' where email='fine@x.com'")), /row-level security/);
});

test('non-admins are rejected outright', async () => {
  await assert.rejects(assign(STUDENT, TARGET, 'instructor'), /Not authorized/);
  await assert.rejects(invite(STUDENT, 'x@x.com', 'student'), /Not authorized/);
});

test('a super admin can manage the privileged tier but never remove the last super admin', async () => {
  await assign(SUPER, TARGET, 'admin'); assert.deepEqual(await rolesOf(TARGET), ['admin', 'student']);
  await remove(SUPER, TARGET, 'admin'); assert.deepEqual(await rolesOf(TARGET), ['student']);
  await invite(SUPER, 'newadmin@x.com', 'admin');
  await as(SUPER, () => q("insert into pending_invites(email,role_name) values('viasuper@x.com','admin')"));
  await remove(SUPER, SUPER2, 'super_admin'); assert.deepEqual(await rolesOf(SUPER2), []);
  await assert.rejects(remove(SUPER, SUPER, 'super_admin'), /Cannot remove the last Super Admin/);
  assert.deepEqual(await rolesOf(SUPER), ['super_admin']);
  await assign(SUPER, SUPER2, 'super_admin'); assert.deepEqual(await rolesOf(SUPER2), ['super_admin']);
});
