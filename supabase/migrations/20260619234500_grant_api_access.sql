grant usage on schema public to anon, authenticated;

grant select on public.roles to anon, authenticated;
grant select on public.courses to anon, authenticated;
grant select on public.lessons to anon, authenticated;
grant select on public.questions to anon, authenticated;
grant select on public.live_sessions to anon, authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select on public.user_roles to authenticated;
grant select, insert on public.attempts to authenticated;
grant select on public.subscriptions to authenticated;
