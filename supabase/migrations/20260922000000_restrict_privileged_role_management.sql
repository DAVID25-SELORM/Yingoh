begin;
-- Separation of duties: the privileged tier ('admin', 'super_admin') can only be granted, revoked,
-- invited or modified by a Super Admin. Ordinary admins keep managing every other role.
-- Also prevents removing the last Super Admin. Same signatures and grants as before; no data is changed.

create or replace function public.admin_assign_role(target_user_id uuid, role_name text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_role text := lower(trim(role_name));
  v_role_id uuid;
  v_actor_super boolean := public.is_super_admin();
  v_target_super boolean;
  v_target_admin boolean;
begin
  if not public.has_role(array['admin', 'super_admin']) then raise exception 'Not authorized'; end if;
  if v_role = 'super_admin' and not v_actor_super then raise exception 'Only a Super Admin can assign the Super Admin role'; end if;
  if v_role = 'admin' and not v_actor_super then raise exception 'Only a Super Admin can assign the Admin role'; end if;
  select coalesce(bool_or(r.name = 'super_admin'), false), coalesce(bool_or(r.name = 'admin'), false)
    into v_target_super, v_target_admin
  from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = target_user_id;
  if v_target_super and not v_actor_super then raise exception 'Only a Super Admin can modify a Super Admin account'; end if;
  if v_target_admin and not v_actor_super then raise exception 'Only a Super Admin can modify an Admin account'; end if;
  select r.id into v_role_id from public.roles r where r.name = v_role;
  if v_role_id is null then raise exception 'Role not found: %', role_name; end if;
  insert into public.user_roles(user_id, role_id) values (target_user_id, v_role_id) on conflict (user_id, role_id) do nothing;
end $$;

create or replace function public.admin_remove_role(target_user_id uuid, role_name text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_role text := lower(trim(role_name));
  v_role_id uuid;
  v_actor_super boolean := public.is_super_admin();
  v_target_super boolean;
  v_target_admin boolean;
begin
  if not public.has_role(array['admin', 'super_admin']) then raise exception 'Not authorized'; end if;
  if v_role = 'super_admin' and not v_actor_super then raise exception 'Only a Super Admin can remove the Super Admin role'; end if;
  if v_role = 'admin' and not v_actor_super then raise exception 'Only a Super Admin can remove the Admin role'; end if;
  select coalesce(bool_or(r.name = 'super_admin'), false), coalesce(bool_or(r.name = 'admin'), false)
    into v_target_super, v_target_admin
  from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = target_user_id;
  if v_target_super and not v_actor_super then raise exception 'Only a Super Admin can modify a Super Admin account'; end if;
  if v_target_admin and not v_actor_super then raise exception 'Only a Super Admin can modify an Admin account'; end if;
  select r.id into v_role_id from public.roles r where r.name = v_role;
  if v_role_id is null then return; end if;
  if v_role = 'super_admin' and v_target_super
     and (select count(distinct ur.user_id) from public.user_roles ur where ur.role_id = v_role_id) <= 1 then
    raise exception 'Cannot remove the last Super Admin';
  end if;
  delete from public.user_roles ur where ur.user_id = target_user_id and ur.role_id = v_role_id;
end $$;

create or replace function public.admin_invite_user(p_email text, p_full_name text, p_role_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_invite_id uuid;
  v_role text := lower(trim(p_role_name));
begin
  if not public.has_role(array['admin', 'super_admin']) then raise exception 'Not authorized'; end if;
  if v_role = 'super_admin' and not public.is_super_admin() then raise exception 'Only a Super Admin can invite another Super Admin'; end if;
  if v_role = 'admin' and not public.is_super_admin() then raise exception 'Only a Super Admin can invite an Admin'; end if;
  insert into public.pending_invites(email, full_name, role_name)
  values (lower(trim(p_email)), p_full_name, v_role)
  on conflict (email) do update set full_name = excluded.full_name, role_name = excluded.role_name,
    expires_at = now() + interval '7 days', accepted_at = null
  returning id into v_invite_id;
  return v_invite_id;
end $$;

-- Direct table writes to invites follow the same rule (the invite role is applied at signup).
drop policy if exists "invites_admin_all" on public.pending_invites;
create policy "invites_admin_all" on public.pending_invites for all to authenticated
using (public.is_super_admin() or (public.has_role(array['admin']) and coalesce(role_name, '') not in ('admin', 'super_admin')))
with check (public.is_super_admin() or (public.has_role(array['admin']) and coalesce(role_name, '') not in ('admin', 'super_admin')));

grant execute on function public.admin_assign_role(uuid, text), public.admin_remove_role(uuid, text),
  public.admin_invite_user(text, text, text) to authenticated;
commit;
