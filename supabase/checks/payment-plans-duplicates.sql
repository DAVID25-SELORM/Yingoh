-- Read-only checks for the duplicate-plans fix. Safe to run in the Supabase SQL editor at any time.
-- Run BEFORE and AFTER applying 20260923010000_deduplicate_payment_plans.sql.

-- 1) Plans that exist more than once (expect rows BEFORE the fix, none AFTER).
select p.audience, lower(btrim(p.name)) as plan, count(*) as copies,
       count(*) filter (where p.is_active) as active_copies, array_agg(p.id order by p.created_at, p.id) as ids
from public.payment_plans p
group by p.audience, lower(btrim(p.name))
having count(*) > 1
order by 1, 2;

-- 2) What the app should show: one row per plan (expect 5 for students/educators: Explorer, 30-Day, 90-Day, 180-Day, 365-Day).
select id, name, audience, price_usd, duration_days, is_active, sort_order, created_at
from public.payment_plans
order by sort_order, created_at;

-- 3) How many records reference each plan (so nothing is lost when copies are merged).
select 'invoices' as source, plan_id, count(*) from public.invoices where plan_id is not null group by plan_id
union all select 'institution_accounts', plan_id, count(*) from public.institution_accounts where plan_id is not null group by plan_id
union all select 'access_grants', plan_id, count(*) from public.access_grants group by plan_id
union all select 'access_payment_orders', plan_id, count(*) from public.access_payment_orders group by plan_id
union all select 'promo_codes (restricted plan)', restricted_plan_id, count(*) from public.promo_codes where restricted_plan_id is not null group by restricted_plan_id
order by 1, 2;

-- 4) After the fix: the unique rule exists (expect one row).
select indexname, indexdef from pg_indexes
where schemaname = 'public' and tablename = 'payment_plans' and indexname = 'payment_plans_audience_name_key';
