begin;

-- One indexed due timestamp per user; dates are interpreted in the saved IANA zone.
create table public.user_email_preferences (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 daily_question_enabled boolean not null default true,
 daily_question_time time not null default '07:00',
 timezone text not null default 'Africa/Accra',
 next_due_at timestamptz not null default now(),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index email_preferences_due on public.user_email_preferences(next_due_at,user_id) where daily_question_enabled;
create table public.daily_email_config (
 id boolean primary key default true check(id), enabled boolean not null default false,
 updated_at timestamptz not null default now()
);
-- Activate deliberately after deployment/configuration checks; no live sends in migration.
insert into public.daily_email_config(id) values(true);
create table public.daily_question_deliveries (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 question_id uuid not null references public.questions(id),
 scheduled_date date not null, timezone text not null,
 status text not null default 'scheduled' check(status in ('scheduled','reserved','sending','sent','failed','answered')),
 scheduled_for timestamptz not null, reserved_at timestamptz, sending_at timestamptz,
 sent_at timestamptz, failed_at timestamptz, provider_message_id text, recipient_email text,
 retry_count integer not null default 0 check(retry_count between 0 and 3),
 next_attempt_at timestamptz not null default now(), last_error text,
 retryable boolean not null default true, lease_token uuid,
 answered_at timestamptz, selected_answer jsonb, is_correct boolean,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(user_id,scheduled_date)
);
create index daily_delivery_pending on public.daily_question_deliveries(next_attempt_at,scheduled_for) where status in ('scheduled','reserved','failed') and retryable;
create index daily_delivery_history on public.daily_question_deliveries(user_id,question_id,scheduled_date desc);
create index daily_delivery_admin on public.daily_question_deliveries(scheduled_date desc,status,created_at desc);
create index daily_delivery_stale on public.daily_question_deliveries(sending_at) where status='sending';
create table public.daily_email_suppressions (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 email text not null, reason text not null, created_at timestamptz not null default now()
);
alter table public.daily_email_suppressions enable row level security;
revoke all on public.daily_email_suppressions from anon,authenticated;
grant all on public.daily_email_suppressions to service_role;
-- Preserve known question history from the shared-question campaign.
insert into public.daily_question_deliveries(user_id,question_id,scheduled_date,timezone,status,scheduled_for,sent_at,answered_at,selected_answer,is_correct,retryable)
 select e.user_id,q.question_id,e.date,'UTC',case when a.id is null then 'sent' else 'answered' end,e.date::timestamp at time zone 'UTC',e.sent_at,a.answered_at,a.answer,a.is_correct,false
 from public.daily_question_emails_sent e join public.daily_questions q on q.date=e.date
 left join public.daily_question_attempts a on a.user_id=e.user_id and a.daily_question_id=q.id
 on conflict(user_id,scheduled_date) do nothing;

alter table public.user_email_preferences enable row level security;
alter table public.daily_question_deliveries enable row level security;
alter table public.daily_email_config enable row level security;
create policy email_preferences_read on public.user_email_preferences for select to authenticated using(user_id=auth.uid());
create policy email_preferences_update on public.user_email_preferences for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy daily_config_read on public.daily_email_config for select to authenticated using(public.has_role(array['admin','super_admin']));
create policy daily_config_update on public.daily_email_config for update to authenticated using(public.has_role(array['admin','super_admin'])) with check(public.has_role(array['admin','super_admin']));
-- Delivery access is through owner-checked RPCs, not direct client mutations.
revoke all on public.user_email_preferences,public.daily_question_deliveries,public.daily_email_config from anon,authenticated;
grant select on public.user_email_preferences,public.daily_email_config to authenticated;
grant update(daily_question_enabled,daily_question_time,timezone) on public.user_email_preferences to authenticated;
grant update(enabled) on public.daily_email_config to authenticated;
grant all on public.user_email_preferences,public.daily_question_deliveries,public.daily_email_config to service_role;

create function public.validate_daily_email_preference() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from pg_timezone_names where name=new.timezone and (name like '%/%' or name='UTC') and name not like 'posix/%' and name not like 'right/%') then raise exception 'Choose a valid IANA timezone'; end if;
 if new.daily_question_time >= time '24:00' then raise exception 'Invalid delivery time'; end if;
 new.next_due_at := (((now() at time zone new.timezone)::date + new.daily_question_time) at time zone new.timezone);
 new.updated_at := now();
 return new;
end $$;
create trigger validate_daily_email_preference before insert or update of daily_question_enabled,daily_question_time,timezone on public.user_email_preferences for each row execute function public.validate_daily_email_preference();
insert into public.user_email_preferences(user_id,daily_question_enabled)
 select p.id,coalesce(lp.daily_email,true) from public.profiles p left join public.learning_profiles lp on lp.user_id=p.id on conflict do nothing;
create function public.create_daily_email_preference() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into public.user_email_preferences(user_id) values(new.id) on conflict do nothing; return new; end $$;
create trigger create_daily_email_preference after insert on public.profiles for each row execute function public.create_daily_email_preference();
-- Keep older clients' opt-out controls effective. The new UI uses the canonical table.
create function public.sync_legacy_daily_email() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_op='INSERT' and new.daily_email then
   select daily_question_enabled into new.daily_email from public.user_email_preferences where user_id=new.user_id;
   new.daily_email:=coalesce(new.daily_email,true);
 end if;
 if tg_op='INSERT' or new.daily_email is distinct from old.daily_email then
 update public.user_email_preferences set daily_question_enabled=new.daily_email where user_id=new.user_id and daily_question_enabled is distinct from new.daily_email;
 end if;
 return new;
end $$;
create trigger sync_legacy_daily_email before insert or update of daily_email on public.learning_profiles for each row execute function public.sync_legacy_daily_email();
create function public.sync_daily_email_to_legacy() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if pg_trigger_depth()>1 then return new; end if;
 update public.learning_profiles set daily_email=new.daily_question_enabled where user_id=new.user_id and daily_email is distinct from new.daily_question_enabled;
 return new;
end $$;
create trigger sync_daily_email_to_legacy after update of daily_question_enabled on public.user_email_preferences for each row execute function public.sync_daily_email_to_legacy();

-- Existing product policy: learning emails are a paid entitlement (not all free accounts).
-- Use the verified Auth address, not the editable profile email.
create function public.daily_email_eligible(p_user uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from auth.users u join public.profiles p on p.id=u.id
 where u.id=p_user and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now())
 and u.email_confirmed_at is not null and u.email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 and not exists(select 1 from public.daily_email_suppressions b where b.user_id=u.id and lower(b.email)=lower(u.email))
 and not exists(select 1 from public.instructor_profiles i where i.user_id=u.id and i.account_status<>'active')
 and exists(select 1 from public.subscriptions s where s.user_id=u.id and s.status='active'
 and (s.current_period_end is null or s.current_period_end>now()) and lower(trim(s.plan_name)) not in ('','free')));
$$;
create function public.daily_email_question_eligible(q public.questions) returns boolean language sql immutable set search_path=public as $$
 select q.status='published' and q.question_type in ('mcq','sata') and q.minimum_plan in ('free','starter')
 and q.clinical_review_status in ('approved','legacy') and length(trim(coalesce(q.rationale,'')))>=80
 and jsonb_typeof(q.choices)='array' and jsonb_typeof(q.correct_answer->'ids')='array'
 and jsonb_array_length(case when jsonb_typeof(q.choices)='array' then q.choices else '[]'::jsonb end)>=2
 and jsonb_array_length(case when jsonb_typeof(q.correct_answer->'ids')='array' then q.correct_answer->'ids' else '[]'::jsonb end)>=1
 and (q.question_type<>'mcq' or jsonb_array_length(case when jsonb_typeof(q.correct_answer->'ids')='array' then q.correct_answer->'ids' else '[]'::jsonb end)=1)
 and not exists(select 1 from jsonb_array_elements_text(case when jsonb_typeof(q.correct_answer->'ids')='array' then q.correct_answer->'ids' else '[]'::jsonb end) a where not exists(select 1 from jsonb_array_elements(case when jsonb_typeof(q.choices)='array' then q.choices else '[]'::jsonb end) c where c->>'id'=a))
 and not exists(select 1 from jsonb_array_elements(case when jsonb_typeof(q.choices)='array' then q.choices else '[]'::jsonb end) c where nullif(c->>'id','') is null or nullif(c->>'text','') is null);
$$;

create function public.reserve_daily_emails(p_limit integer default 100) returns jsonb language plpgsql security definer set search_path=public as $$
declare pref public.user_email_preferences; local_day date; qid uuid; due integer:=0; made integer:=0; conflicts integer:=0; no_question integer:=0; inserted integer;
begin
 perform 1 from public.daily_email_config where id and enabled for share;
 if not found then return jsonb_build_object('due',0,'reserved',0,'conflicts',0); end if;
 for pref in select * from public.user_email_preferences where daily_question_enabled and next_due_at<=now()
 order by next_due_at,user_id limit greatest(1,least(p_limit,500)) for update skip locked loop
 due:=due+1; local_day:=(now() at time zone pref.timezone)::date;
 -- A stale due timestamp never causes a previous local day's catch-up email.
 if (local_day+pref.daily_question_time) at time zone pref.timezone > now() then
 update public.user_email_preferences set next_due_at=(local_day+pref.daily_question_time) at time zone pref.timezone where user_id=pref.user_id;
 continue;
 end if;
 if public.daily_email_eligible(pref.user_id) and not exists(select 1 from public.daily_question_emails_sent e where e.user_id=pref.user_id and e.date=local_day) then
 select q.id into qid from public.questions q
 left join lateral (select max(d.scheduled_date) last_day from public.daily_question_deliveries d where d.user_id=pref.user_id and d.question_id=q.id) h on true
 where public.daily_email_question_eligible(q)
 order by h.last_day nulls first,q.id limit 1;
 if qid is not null then
 insert into public.daily_question_deliveries(user_id,question_id,scheduled_date,timezone,scheduled_for)
 values(pref.user_id,qid,local_day,pref.timezone,(local_day+pref.daily_question_time) at time zone pref.timezone) on conflict(user_id,scheduled_date) do nothing;
 get diagnostics inserted=row_count; made:=made+inserted; conflicts:=conflicts+1-inserted;
 else no_question:=no_question+1;
 end if;
 end if;
 update public.user_email_preferences set next_due_at=((local_day+1)+pref.daily_question_time) at time zone pref.timezone where user_id=pref.user_id;
 end loop;
 return jsonb_build_object('due',due,'reserved',made,'conflicts',conflicts,'no_question',no_question);
end $$;

create function public.claim_daily_email() returns jsonb language plpgsql security definer set search_path=public as $$
declare d public.daily_question_deliveries;
begin
 if not (select enabled from public.daily_email_config where id) then return null; end if;
 -- Ambiguous SMTP outcomes must not automatically resend after a process crash.
 update public.daily_question_deliveries set status='failed',retryable=false,last_error='delivery_outcome_unknown',failed_at=now(),updated_at=now()
 where id in (select id from public.daily_question_deliveries where status='sending' and sending_at<now()-interval '10 minutes' order by sending_at limit 100 for update skip locked);
 select x.* into d from public.daily_question_deliveries x join public.user_email_preferences p on p.user_id=x.user_id
 where x.status in ('scheduled','reserved','failed') and x.retryable and x.retry_count<3 and x.next_attempt_at<=now()
 and (x.status<>'reserved' or x.reserved_at<now()-interval '5 minutes')
 and x.scheduled_date=(now() at time zone x.timezone)::date and p.daily_question_enabled
 and public.daily_email_eligible(x.user_id) and exists(select 1 from public.questions q where q.id=x.question_id and public.daily_email_question_eligible(q))
 order by x.scheduled_for,x.id limit 1 for update of x skip locked;
 if not found then return null; end if;
 update public.daily_question_deliveries set status='reserved',reserved_at=now(),lease_token=gen_random_uuid(),updated_at=now() where id=d.id returning * into d;
 return jsonb_build_object('id',d.id,'lease_token',d.lease_token);
end $$;

create function public.begin_daily_email(p_id uuid,p_token uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare d public.daily_question_deliveries; q public.questions; recipient text; name text;
begin
 -- Serialize the send authorization with a global pause. Already authorized sends may finish.
 perform 1 from public.daily_email_config where id and enabled for share; if not found then return null; end if;
 select * into d from public.daily_question_deliveries where id=p_id and lease_token=p_token and status='reserved' for update;
 if not found then return null; end if;
 if not public.daily_email_eligible(d.user_id) or not exists(select 1 from public.user_email_preferences where user_id=d.user_id and daily_question_enabled)
 or d.scheduled_date<>(now() at time zone d.timezone)::date then return null; end if;
 select * into q from public.questions where id=d.question_id and public.daily_email_question_eligible(questions);
 if not found then return null; end if;
 select u.email,p.full_name into recipient,name from auth.users u join public.profiles p on p.id=u.id where u.id=d.user_id;
 update public.daily_question_deliveries set status='sending',sending_at=now(),retry_count=retry_count+1,recipient_email=recipient,updated_at=now() where id=d.id;
 return jsonb_build_object('id',d.id,'email',recipient,'name',name,'topic',q.topic,'prompt',q.prompt,'choices',q.choices);
end $$;

create function public.finish_daily_email(p_id uuid,p_token uuid,p_outcome text,p_message_id text default null) returns boolean language plpgsql security definer set search_path=public as $$
declare changed_user uuid;
begin
 if p_outcome not in ('sent','temporary_rejection','permanent_rejection','invalid_recipient','delivery_outcome_unknown') then raise exception 'Invalid outcome'; end if;
 update public.daily_question_deliveries set
 status=case when p_outcome='sent' then case when answered_at is null then 'sent' else 'answered' end else 'failed' end,
 sent_at=case when p_outcome='sent' then now() else sent_at end,
 failed_at=case when p_outcome<>'sent' then now() else failed_at end,
 provider_message_id=case when p_outcome='sent' then left(p_message_id,200) else provider_message_id end,
 retryable=p_outcome='temporary_rejection' and retry_count<3,
 next_attempt_at=now()+make_interval(mins=>5*retry_count*retry_count),
 last_error=case when p_outcome='sent' then null else p_outcome end,updated_at=now()
 where id=p_id and lease_token=p_token and (status='sending' or (status='failed' and last_error='delivery_outcome_unknown')) returning user_id into changed_user;
 if changed_user is null then return false; end if;
 if p_outcome='invalid_recipient' then
 insert into public.daily_email_suppressions(user_id,email,reason) select user_id,recipient_email,'invalid_recipient' from public.daily_question_deliveries where id=p_id
 on conflict(user_id) do update set email=excluded.email,reason=excluded.reason,created_at=now();
 end if;
 return true;
end $$;

create function public.get_daily_delivery(p_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare d public.daily_question_deliveries; q public.questions; content jsonb;
begin
 select * into d from public.daily_question_deliveries where id=p_id and user_id=auth.uid();
 if not found then raise exception 'Assigned question unavailable'; end if;
 select * into q from public.questions where id=d.question_id and status='published';
 if not found then raise exception 'Assigned question unavailable'; end if;
 content:=jsonb_build_object('id',q.id,'topic',q.topic,'question_type',q.question_type,'prompt',q.prompt,'choices',q.choices);
 if d.answered_at is not null then content:=content||jsonb_build_object('correct_answer',q.correct_answer,'rationale',q.rationale,'strategy',q.strategy,'reference_url',q.reference_url,'correct_answer_explanation',q.correct_answer_explanation,'option_explanations',q.option_explanations,'immediate_response',q.immediate_response,'reference_urls',q.reference_urls,'reviewed_at',q.reviewed_at); end if;
 return jsonb_build_object('id',d.id,'scheduled_date',d.scheduled_date,'question',content,'answered_at',d.answered_at,'selected_answer',d.selected_answer,'is_correct',d.is_correct);
end $$;
create function public.answer_daily_delivery(p_id uuid,p_ids text[]) returns jsonb language plpgsql security definer set search_path=public as $$
declare d public.daily_question_deliveries; q public.questions; chosen text[]; correct text[];
begin
 select * into d from public.daily_question_deliveries where id=p_id and user_id=auth.uid() for update;
 if not found then raise exception 'Assigned question unavailable'; end if;
 if d.answered_at is not null then return public.get_daily_delivery(p_id); end if;
 select * into q from public.questions where id=d.question_id and status='published';
 if not found then raise exception 'Assigned question unavailable'; end if;
 if p_ids is null or cardinality(p_ids)=0 or cardinality(p_ids)>100 or exists(select 1 from unnest(p_ids) v where v is null or not exists(select 1 from jsonb_array_elements(q.choices) c where c->>'id'=v)) then raise exception 'Select valid answer options'; end if;
 select array_agg(distinct v order by v) into chosen from unnest(p_ids) v;
 if q.question_type='mcq' and cardinality(chosen)<>1 then raise exception 'Select one answer'; end if;
 select array_agg(distinct v order by v) into correct from jsonb_array_elements_text(q.correct_answer->'ids') v;
 update public.daily_question_deliveries set selected_answer=jsonb_build_object('ids',chosen),is_correct=chosen=correct,answered_at=now(),updated_at=now(),status=case when status='sent' then 'answered' else status end where id=p_id;
 return public.get_daily_delivery(p_id);
end $$;

create function public.admin_daily_emails(p_date date default current_date,p_status text default null,p_search text default '',p_page integer default 0) returns jsonb language plpgsql security definer set search_path=public as $$
declare metrics jsonb; history jsonb;
begin
 if not public.has_role(array['admin','super_admin']) then raise exception 'Administrator access required'; end if;
 select jsonb_build_object('total',count(*),'scheduled',count(*) filter(where status in ('scheduled','reserved')),'sent',count(*) filter(where sent_at is not null),'pending',count(*) filter(where status in ('scheduled','reserved','sending') or (status='failed' and retryable)),'failed',count(*) filter(where status='failed'),'answered',count(*) filter(where answered_at is not null),'correct',count(*) filter(where is_correct),'incorrect',count(*) filter(where is_correct=false)) into metrics from public.daily_question_deliveries where scheduled_date=p_date;
 select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) into history from (
 select d.id,d.user_id,p.full_name,coalesce(d.recipient_email,u.email) email,d.question_id,d.scheduled_date,d.scheduled_for,d.timezone,d.status,d.sent_at,d.answered_at,d.is_correct,d.retry_count,d.last_error,d.retryable
 from public.daily_question_deliveries d join public.profiles p on p.id=d.user_id join auth.users u on u.id=d.user_id
 where d.scheduled_date=p_date and (p_status is null or d.status=p_status) and (p_search='' or u.email ilike '%'||left(p_search,100)||'%' or p.full_name ilike '%'||left(p_search,100)||'%')
 order by d.created_at desc,d.id limit 50 offset least(greatest(p_page,0),10000)*50) r;
 return jsonb_build_object('metrics',metrics,'rows',history,'enabled',(select enabled from public.daily_email_config where id));
end $$;

-- Default function EXECUTE privileges must never expose the worker to clients.
do $$ declare f record; begin
 for f in select oid::regprocedure sig from pg_proc where pronamespace='public'::regnamespace and proname in
 ('validate_daily_email_preference','create_daily_email_preference','sync_legacy_daily_email','sync_daily_email_to_legacy','daily_email_eligible','daily_email_question_eligible','reserve_daily_emails','claim_daily_email','begin_daily_email','finish_daily_email','get_daily_delivery','answer_daily_delivery','admin_daily_emails') loop
 execute format('revoke all on function %s from public,anon,authenticated',f.sig);
 execute format('grant execute on function %s to service_role',f.sig);
 end loop;
end $$;
grant execute on function public.get_daily_delivery(uuid),public.answer_daily_delivery(uuid,text[]),public.admin_daily_emails(date,text,text,integer) to authenticated;
-- Prevent a stale deployment of the old campaign from sending in parallel.
create or replace function public.list_daily_question_recipients() returns table(user_id uuid,email text,full_name text) language sql security definer set search_path=public as $$ select null::uuid,null::text,null::text where false $$;
commit;
