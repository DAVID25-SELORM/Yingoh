-- Configure the bootstrap super admin account.

insert into public.roles (name, description)
values
  ('super_admin', 'Full platform owner access across users, roles, content, payments, and operations.')
on conflict (name) do update set description = excluded.description;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  default_role_id uuid;
  super_admin_role_id uuid;
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1), 'Yingoh learner'),
    new.email
  )
  on conflict (id) do update
    set
      full_name = excluded.full_name,
      email = excluded.email,
      updated_at = now();

  select id into default_role_id from public.roles where name = 'student';
  if default_role_id is not null then
    insert into public.user_roles (user_id, role_id)
    values (new.id, default_role_id)
    on conflict (user_id, role_id) do nothing;
  end if;

  if lower(new.email) = 'cryxtalcfc@gmail.com' then
    select id into super_admin_role_id from public.roles where name = 'super_admin';
    if super_admin_role_id is not null then
      insert into public.user_roles (user_id, role_id)
      values (new.id, super_admin_role_id)
      on conflict (user_id, role_id) do nothing;
    end if;
  end if;

  return new;
end;
$$;

insert into public.user_roles (user_id, role_id)
select profiles.id, roles.id
from public.profiles
cross join public.roles
where lower(profiles.email) = 'cryxtalcfc@gmail.com'
  and roles.name = 'super_admin'
on conflict (user_id, role_id) do nothing;
