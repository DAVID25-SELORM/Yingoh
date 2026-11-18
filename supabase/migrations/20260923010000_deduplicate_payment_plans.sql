begin;
-- Merge duplicated subscription plan rows and stop them recurring.
-- payment_plans.name had no uniqueness rule, so re-run seeds/imports left every plan listed more than once
-- (each screen renders the table rows directly). For each group of rows with the same audience and the same
-- name (ignoring case and surrounding spaces) this keeps ONE row, repoints every foreign key that referenced
-- the others to it, then removes the extras. Nothing else is touched; no plan is renamed or repriced.
--
-- Keeper rule (the app uses the same one): active before inactive, then lowest sort_order, then oldest, then id.
-- Referencing tables are discovered from the catalog, so invoices, billing transactions, access grants,
-- promotion restrictions and payment orders are all handled, including any added later.
-- A failure (for example a unique key that would collide after repointing) aborts the whole migration.
do $$
declare
  grp record;
  keeper uuid;
  extra uuid;
  ref record;
  merged integer := 0;
  repointed integer := 0;
  changed integer;
begin
  for grp in
    select p.audience, lower(btrim(p.name)) as plan_key
    from public.payment_plans p
    group by p.audience, lower(btrim(p.name))
    having count(*) > 1
    order by 1, 2
  loop
    select p.id into keeper
    from public.payment_plans p
    where p.audience = grp.audience and lower(btrim(p.name)) = grp.plan_key
    order by p.is_active desc, p.sort_order, p.created_at, p.id
    limit 1;

    for extra in
      select p.id from public.payment_plans p
      where p.audience = grp.audience and lower(btrim(p.name)) = grp.plan_key and p.id <> keeper
      order by p.created_at, p.id
    loop
      for ref in
        select c.conrelid::regclass::text as table_name, a.attname as column_name
        from pg_constraint c
        join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
        where c.contype = 'f' and c.confrelid = 'public.payment_plans'::regclass and cardinality(c.conkey) = 1
      loop
        execute format('update %s set %I = $1 where %I = $2', ref.table_name, ref.column_name, ref.column_name) using keeper, extra;
        get diagnostics changed = row_count;
        repointed := repointed + changed;
      end loop;
      delete from public.payment_plans where id = extra;
      merged := merged + 1;
    end loop;
  end loop;
  raise notice 'payment_plans: removed % duplicate row(s); repointed % reference(s)', merged, repointed;
end $$;

-- One plan per name within an audience, case- and space-insensitive.
create unique index if not exists payment_plans_audience_name_key
  on public.payment_plans (audience, lower(btrim(name)));
commit;
