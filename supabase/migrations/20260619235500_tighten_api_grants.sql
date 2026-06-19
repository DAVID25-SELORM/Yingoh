revoke all on all tables in schema public from anon, authenticated;

grant usage on schema public to anon, authenticated;

grant select on public.roles to anon, authenticated;
grant select on public.courses to anon, authenticated;
grant select on public.lessons to anon, authenticated;
grant select on public.questions to anon, authenticated;
grant select on public.live_sessions to anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant select on public.attempts to anon, authenticated;
grant select on public.subscriptions to anon, authenticated;

grant insert, update on public.profiles to authenticated;
grant select on public.user_roles to authenticated;
grant insert on public.attempts to authenticated;
