import { readFile } from 'node:fs/promises';
export const admin='00000000-0000-4000-8000-000000000001';
export const student='00000000-0000-4000-8000-000000000002';
export const other='00000000-0000-4000-8000-000000000003';
export const plan='00000000-0000-4000-8000-000000000004';
export const bootstrap = String.raw`
create role anon; create role authenticated; create role service_role;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('test.uid',true),'')::uuid $$;
grant usage on schema public,auth to authenticated;
create table profiles(id uuid primary key,email text,full_name text);
create table roles(id uuid primary key default gen_random_uuid(),name text);
create table permissions(id text primary key,group_key text,label text);
create table role_permissions(role_id uuid,permission_id text,primary key(role_id,permission_id));
create table user_roles(user_id uuid,role_id uuid);
create function has_role(p_roles text[]) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from user_roles u join roles r on r.id=u.role_id where u.user_id=auth.uid() and r.name=any(p_roles)) $$;
create function has_permission(p text) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from user_roles u join role_permissions r on r.role_id=u.role_id where u.user_id=auth.uid() and r.permission_id=p) $$;
create table payment_plans(id uuid primary key,name text,price_usd numeric,duration_days integer,is_active boolean);
create table subscriptions(id uuid primary key default gen_random_uuid(),user_id uuid,plan_name text,status text,provider text,provider_reference text,current_period_end timestamptz,created_at timestamptz default now());
create table invoices(id uuid primary key);
create table promo_codes(id uuid primary key default gen_random_uuid(),code text unique not null,discount_pct integer default 0,
 max_uses integer,used_count integer not null default 0,expires_at timestamptz,is_active boolean not null default true,created_at timestamptz default now());
alter table promo_codes enable row level security;
grant select,insert,update,delete on promo_codes to authenticated;
create policy promos_admin_all on promo_codes to authenticated
 using(has_role(array['admin','super_admin','finance'])) with check(has_role(array['admin','super_admin','finance']));
create table notifications(id uuid primary key default gen_random_uuid(),user_id uuid,title text,message text,type text,link text,created_at timestamptz default now());
create table admin_audit_logs(id uuid primary key default gen_random_uuid(),admin_id uuid,action text,target_table text,target_id uuid,details jsonb,created_at timestamptz default now());
insert into profiles values
 ('00000000-0000-4000-8000-000000000001','admin@example.test','Admin'),
 ('00000000-0000-4000-8000-000000000002','student@example.test','Student'),
 ('00000000-0000-4000-8000-000000000003','other@example.test','Other');
insert into roles(name) values('admin'),('super_admin'),('student'),('finance');
insert into user_roles select '00000000-0000-4000-8000-000000000001',id from roles where name='super_admin';
insert into user_roles select '00000000-0000-4000-8000-000000000002',id from roles where name='student';
insert into user_roles select '00000000-0000-4000-8000-000000000003',id from roles where name='finance';
insert into payment_plans values('00000000-0000-4000-8000-000000000004','30-Day Pass',19,30,true);
`;
export const migrations=[
 '20260719200000_promo_code_engine.sql',
 '20260919200000_access_grant_foundation.sql',
 '20260919210000_access_entitlement_adapters.sql',
 '20260919220000_access_server_controls.sql',
 '20260919230000_bulk_access_grants.sql',
 '20260920000000_access_reporting_notifications.sql',
 '20260920010000_transactional_promotions.sql',
 '20260920020000_hubtel_order_lifecycle.sql',
 '20260920030000_access_combined_reporting.sql',
];
export async function install(exec) {
 await exec(bootstrap);
 for(const file of migrations) await exec(await readFile(new URL('../../supabase/migrations/'+file,import.meta.url),'utf8'));
}
export function promoConfig(overrides={}) {
 return {code:'WELCOME30',name:'Welcome',description:'Synthetic test',benefit_type:'free_access_days',benefit_units:30,
 starts_at:'2020-01-01T00:00:00Z',expires_at:'2099-01-01T00:00:00Z',max_uses:100,per_user_limit:1,
 minimum_ghs_minor:0,plan_id:null,new_users_only:false,...overrides};
}
