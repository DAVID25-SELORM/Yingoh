begin;

-- Qualify columns that share names with RETURNS TABLE output variables.
-- Preserve the existing authorization, grant/deny semantics and function ACL.
create or replace function public.admin_get_effective_permissions(target_user_id uuid)
returns table(permission_id text, label text, group_key text, source text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if auth.uid() <> target_user_id and not public.has_role(array['admin', 'super_admin']) then
    raise exception 'Not authorized';
  end if;

  return query
  with role_grants as (
    select distinct p.id as permission_id, p.label, p.group_key, 'role'::text as source
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p on p.id = rp.permission_id
    where ur.user_id = target_user_id
  ),
  explicit_denies as (
    select upo.permission_id
    from public.user_permission_overrides upo
    where upo.user_id = target_user_id and upo.effect = 'deny'
  ),
  explicit_allows as (
    select p.id as permission_id, p.label, p.group_key, 'override'::text as source
    from public.user_permission_overrides upo
    join public.permissions p on p.id = upo.permission_id
    where upo.user_id = target_user_id and upo.effect = 'allow'
  )
  select rg.permission_id, rg.label, rg.group_key, rg.source
  from role_grants rg
  where rg.permission_id not in (select ed.permission_id from explicit_denies ed)
  union
  select ea.permission_id, ea.label, ea.group_key, ea.source
  from explicit_allows ea
  order by 3, 1;
end;
$$;

commit;
