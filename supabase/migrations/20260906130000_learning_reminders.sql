begin;
create table if not exists public.learning_reminder_log (
 user_id uuid not null references public.profiles(id), source_id uuid not null, kind text not null,
 due_on date not null, reminder_day date not null default current_date,
 primary key(user_id,source_id,kind,due_on,reminder_day)
);
alter table public.learning_reminder_log enable row level security;
create or replace function public.queue_learning_reminders() returns integer language plpgsql security definer set search_path=public as $$
declare r record; sent integer:=0;
begin
 for r in
   select user_id,id,'cpd'::text kind,title,expires_on due_on,'CPD Centre'::text destination from public.cpd_records where source='external' and expires_on between current_date and current_date+30
   union all
   select user_id,id,'competency',title,coalesce(expires_on,due_on),'Competencies' from public.competency_assignments where coalesce(expires_on,due_on) between current_date and current_date+30
   union all
   select user_id,id,'certificate',title,expires_at::date,'Certificates' from public.user_certificates where status='active' and expires_at::date between current_date and current_date+30
   union all
   select author_id,id,'content_review',title,next_review_on,'Learning Content' from public.learning_items where status='published' and next_review_on between current_date and current_date+30
 loop
   if r.due_on-current_date not in (0,7,30) then continue; end if;
   insert into public.learning_reminder_log(user_id,source_id,kind,due_on) values(r.user_id,r.id,r.kind,r.due_on) on conflict do nothing;
   if found then
     insert into public.notifications(user_id,title,message,type,link) values(r.user_id,'Learning renewal reminder',r.title||' — due '||r.due_on,'warning','/#/'||replace(r.destination,' ','%20'));
     sent:=sent+1;
   end if;
 end loop;
 return sent;
end; $$;
revoke all on function public.queue_learning_reminders() from public,anon,authenticated;
grant execute on function public.queue_learning_reminders() to service_role;
-- Optional scheduler: supports installations with pg_cron enabled, without requiring it.
do $$ begin
 if exists(select 1 from pg_extension where extname='pg_cron') then
   perform cron.schedule('nursefaculty-learning-reminders','0 8 * * *','select public.queue_learning_reminders()');
 end if;
end $$;
commit;
