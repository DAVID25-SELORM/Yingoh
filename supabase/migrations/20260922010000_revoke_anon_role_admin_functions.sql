begin;
-- Role-administration functions already reject unauthenticated callers, but they inherited EXECUTE for
-- anon/PUBLIC from default privileges. Remove it (defense in depth). Signed-in users keep EXECUTE.
revoke all on function public.admin_assign_role(uuid, text), public.admin_remove_role(uuid, text),
  public.admin_invite_user(text, text, text), public.admin_get_all_users() from public, anon;
grant execute on function public.admin_assign_role(uuid, text), public.admin_remove_role(uuid, text),
  public.admin_invite_user(text, text, text), public.admin_get_all_users() to authenticated;
commit;
