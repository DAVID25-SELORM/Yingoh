begin;
create table public.daily_email_diagnostic_runs (
 id text primary key check(id='production-readiness-20260919'),
 started_at timestamptz not null default now(),
 finished_at timestamptz,
 outcome text not null default 'delivery_outcome_unknown'
 check(outcome in ('delivery_outcome_unknown','smtp_accepted','temporary_rejection','permanent_rejection','invalid_recipient'))
);
alter table public.daily_email_diagnostic_runs enable row level security;
revoke all on public.daily_email_diagnostic_runs from public,anon,authenticated;
grant select,update on public.daily_email_diagnostic_runs to service_role;
create function public.claim_daily_email_diagnostic() returns boolean
language plpgsql security definer set search_path=public as $$
declare inserted integer;
begin
 perform 1 from public.daily_email_config where id and enabled=false for share;
 if not found then return false; end if;
 insert into public.daily_email_diagnostic_runs(id) values('production-readiness-20260919') on conflict do nothing;
 get diagnostics inserted=row_count;
 return inserted=1;
end $$;
revoke all on function public.claim_daily_email_diagnostic() from public,anon,authenticated;
grant execute on function public.claim_daily_email_diagnostic() to service_role;
commit;
