begin;
insert into public.permissions(id,group_key,label) values('access_grant.bulk_create','access','Bulk grant complimentary access') on conflict do nothing;
insert into public.role_permissions(role_id,permission_id)
 select id,'access_grant.bulk_create' from public.roles where name='super_admin' on conflict do nothing;

create table public.access_grant_batches (
 id uuid primary key default gen_random_uuid(), actor_id uuid not null references public.profiles(id),
 request_key uuid not null, request_payload jsonb not null, result jsonb not null,
 created_at timestamptz not null default now(), unique(actor_id,request_key)
);
alter table public.access_grant_batches enable row level security;
revoke all on public.access_grant_batches from public,anon,authenticated;
grant select on public.access_grant_batches to authenticated;
create policy access_batches_staff on public.access_grant_batches for select to authenticated using
 (public.has_role(array['super_admin']) and public.has_permission('access_grant.bulk_create'));

-- Preview never writes. UI CSV/pasted email/selected-id inputs all converge on
-- this bounded array. Duplicate email matches are ambiguous, not guessed.
create function public.admin_preview_bulk_access(p_entries text[]) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare entry text; normalized text; seen text[]:='{}'; seen_users uuid[]:='{}';
 recipient public.profiles; matches integer; state text; paid boolean; complimentary boolean;
 rows jsonb:='[]'; summary jsonb; result jsonb;
begin
 if auth.uid() is null or not public.has_role(array['super_admin']) or not public.has_permission('access_grant.bulk_create')
 then raise exception 'Not authorized'; end if;
 if p_entries is null or cardinality(p_entries) not between 1 and 100 or array_ndims(p_entries)<>1
 then raise exception 'Submit between 1 and 100 entries'; end if;
 foreach entry in array p_entries loop
  recipient:=null; paid:=false; complimentary:=false;
  normalized:=lower(trim(coalesce(entry,'')));
  if length(normalized)>254 or normalized='' then state:='invalid';
  elsif normalized=any(seen) then state:='duplicate';
  else
   seen:=array_append(seen,normalized);
   if normalized ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    select count(*) into matches from public.profiles p where p.id=normalized::uuid;
    select * into recipient from public.profiles p where p.id=normalized::uuid;
   elsif normalized ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    select count(*) into matches from public.profiles p where lower(trim(p.email))=normalized;
    if matches=1 then select * into recipient from public.profiles p where lower(trim(p.email))=normalized; end if;
   else matches:=-1; end if;
   if matches=-1 then state:='invalid';
   elsif matches<>1 then state:='unknown';
   elsif recipient.id=any(seen_users) then state:='duplicate';
   else
    seen_users:=array_append(seen_users,recipient.id);
    select exists(select 1 from public.subscriptions s where s.user_id=recipient.id and s.status='active'
     and (s.current_period_end is null or s.current_period_end>now()) and public.access_plan_key(s.plan_name)<>'free') into paid;
    select exists(select 1 from public.access_grants g where g.user_id=recipient.id and g.revoked_at is null
     and g.status in ('active','scheduled') and g.expires_at>now()) into complimentary;
    state:=case when paid then 'paid' when complimentary then 'complimentary' else 'eligible' end;
   end if;
  end if;
  rows:=rows||jsonb_build_array(jsonb_build_object('entry',left(normalized,254),'user_id',recipient.id,
   'name',recipient.full_name,'status',state,'paid',paid,'complimentary',complimentary));
 end loop;
 select jsonb_build_object('submitted',count(*),'matched',count(*) filter(where r->>'user_id' is not null),
  'eligible',count(*) filter(where r->>'status'='eligible'),'invalid',count(*) filter(where r->>'status'='invalid'),
  'unknown',count(*) filter(where r->>'status'='unknown'),'duplicates',count(*) filter(where r->>'status'='duplicate'),
  'paid',count(*) filter(where (r->>'paid')::boolean),'complimentary',count(*) filter(where (r->>'complimentary')::boolean),
  'skipped',count(*) filter(where r->>'status'<>'eligible')) into summary from jsonb_array_elements(rows) r;
 result:=jsonb_build_object('rows',rows,'summary',summary);
 return result||jsonb_build_object('preview_hash',md5(result::text));
end $$;

create function public.admin_execute_bulk_access(p_entries text[],p_plan_id uuid,p_starts_at timestamptz,
 p_expires_at timestamptz,p_reason text,p_internal_note text,p_notify boolean,p_request_key uuid,p_preview_hash text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid(); payload jsonb; existing public.access_grant_batches; preview jsonb;
 recipient record; grant_id uuid; grant_ids jsonb:='[]'; batch_id uuid:=gen_random_uuid(); result jsonb;
begin
 if actor is null or not public.has_role(array['super_admin']) or not public.has_permission('access_grant.bulk_create')
  or not public.has_permission('access_grant.create') then raise exception 'Not authorized'; end if;
 if p_request_key is null or p_notify is null then raise exception 'Invalid request'; end if;
 payload:=jsonb_build_object('entries',p_entries,'plan',p_plan_id,'starts',extract(epoch from p_starts_at),
  'expires',extract(epoch from p_expires_at),'reason',p_reason,'note',p_internal_note,'notify',p_notify,'preview',p_preview_hash);
 perform pg_advisory_xact_lock(hashtextextended(actor::text||':'||p_request_key::text,0));
 select * into existing from public.access_grant_batches where actor_id=actor and request_key=p_request_key;
 if found then
  if existing.request_payload<>payload then raise exception 'Idempotency conflict'; end if;
  return existing.result;
 end if;
 if not public.access_feature_enabled('complimentary_access') then raise exception 'Complimentary access is disabled'; end if;
 preview:=public.admin_preview_bulk_access(p_entries);
 -- Canonical recipient ordering avoids deadlocks across intersecting batches.
 perform p.id from public.profiles p where p.id in
  (select (r->>'user_id')::uuid from jsonb_array_elements(preview->'rows') r where r->>'user_id' is not null)
  order by p.id for update;
 preview:=public.admin_preview_bulk_access(p_entries);
 if p_preview_hash is null or preview->>'preview_hash'<>p_preview_hash then raise exception 'Preview changed; review again'; end if;
 if (preview->'summary'->>'eligible')::integer=0 then raise exception 'No eligible recipients'; end if;
 for recipient in select (r->>'user_id')::uuid as id from jsonb_array_elements(preview->'rows') r
  where r->>'status'='eligible' order by (r->>'user_id')::uuid loop
  grant_id:=public.admin_grant_access(recipient.id,p_plan_id,p_starts_at,p_expires_at,p_reason,p_internal_note,gen_random_uuid());
  grant_ids:=grant_ids||jsonb_build_array(grant_id);
  if p_notify then
   perform public.emit_access_notice(recipient.id,'grant:'||grant_id::text||':ACCESS_GRANTED',
    'Complimentary access granted','Your access starts '||p_starts_at::text||' and ends '||p_expires_at::text||'.',true);
  end if;
 end loop;
 result:=jsonb_build_object('batch_id',batch_id,'grant_ids',grant_ids,'summary',preview->'summary');
 insert into public.access_grant_batches(id,actor_id,request_key,request_payload,result) values(batch_id,actor,p_request_key,payload,result);
 insert into public.admin_audit_logs(admin_id,action,target_table,target_id,details)
  values(actor,'BULK_ACCESS_GRANTED','access_grant_batches',batch_id,jsonb_build_object('summary',preview->'summary','reason',p_reason));
 return result;
end $$;
revoke all on function public.admin_preview_bulk_access(text[]) from public,anon;
revoke all on function public.admin_execute_bulk_access(text[],uuid,timestamptz,timestamptz,text,text,boolean,uuid,text) from public,anon;
grant execute on function public.admin_preview_bulk_access(text[]) to authenticated;
grant execute on function public.admin_execute_bulk_access(text[],uuid,timestamptz,timestamptz,text,text,boolean,uuid,text) to authenticated;
commit;
