begin;
-- Opt-in extension of the existing promotion tables. No legacy row is converted.
alter table public.promo_codes
 add column benefit_type text check(benefit_type in ('percentage_discount','fixed_discount','free_access_days')),
 add column benefit_units integer,
 add column minimum_ghs_minor integer not null default 0 check(minimum_ghs_minor>=0),
 add column restricted_plan_id uuid references public.payment_plans(id),
 add column revision integer not null default 1,
 add constraint promotion_benefit_valid check(benefit_type is null or
  (benefit_units>0 and benefit_units is not null and
   (benefit_type<>'percentage_discount' or benefit_units<=10000) and
   (benefit_type<>'free_access_days' or benefit_units<=3650)));
-- Fail safely on ambiguous legacy codes; never delete/rename customer data.
create unique index promo_codes_normalized_unique on public.promo_codes(upper(btrim(code)));
alter table public.promo_redemptions
 add column access_grant_id uuid references public.access_grants(id),
 add column request_key uuid,
 add column request_payload jsonb,
 add column outcome text check(outcome in ('reserved','completed','released')),
 add column original_ghs_minor integer check(original_ghs_minor>=0),
 add column discount_ghs_minor integer check(discount_ghs_minor>=0),
 add column final_ghs_minor integer check(final_ghs_minor>=0);
create unique index promo_redemptions_request on public.promo_redemptions(user_id,request_key) where request_key is not null;
create index promo_redemptions_capacity on public.promo_redemptions(promo_id,outcome,user_id);

insert into public.permissions(id,group_key,label) values
 ('promo.view','access','View promotions'),('promo.create','access','Create promotions'),
 ('promo.edit','access','Edit promotions'),('promo.pause','access','Pause or resume promotions'),
 ('promo.view_redemptions','access','View promotion redemptions')
on conflict(id) do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.name in ('admin','super_admin') and p.id in
 ('promo.view','promo.create','promo.edit','promo.pause','promo.view_redemptions') on conflict do nothing;

-- Restrictive policies intersect the legacy permissive policies. New rows may
-- only be mutated through server-authorized routines, even by finance users.
create function public.is_managed_promotion(p_id uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.promo_codes where id=p_id and benefit_type is not null);
$$;
revoke all on function public.is_managed_promotion(uuid) from public,anon;
grant execute on function public.is_managed_promotion(uuid) to authenticated;
create policy promos_v2_insert on public.promo_codes as restrictive for insert to authenticated
 with check(benefit_type is null);
create policy promos_v2_update on public.promo_codes as restrictive for update to authenticated
 using(benefit_type is null) with check(benefit_type is null);
create policy promos_v2_delete on public.promo_codes as restrictive for delete to authenticated
 using(benefit_type is null);
create policy promos_v2_read on public.promo_codes as restrictive for select to authenticated
 using(benefit_type is null or (public.has_role(array['admin','super_admin']) and public.has_permission('promo.view')));
create policy redemptions_v2_insert on public.promo_redemptions as restrictive for insert to authenticated
 with check(outcome is null and not public.is_managed_promotion(promo_id));
create policy redemptions_v2_update on public.promo_redemptions as restrictive for update to authenticated
 using(outcome is null) with check(outcome is null and not public.is_managed_promotion(promo_id));
create policy redemptions_v2_delete on public.promo_redemptions as restrictive for delete to authenticated using(outcome is null);
create policy redemptions_v2_read on public.promo_redemptions as restrictive for select to authenticated
 using(outcome is null or user_id=auth.uid() or
 (public.has_role(array['admin','super_admin']) and public.has_permission('promo.view_redemptions')));

-- Legacy checkout must not bypass the new capacity/price/feature controls.
alter function public.validate_promo_code(text,text,numeric,uuid) rename to validate_legacy_promo_code;
revoke all on function public.validate_legacy_promo_code(text,text,numeric,uuid) from public,anon,authenticated;
create function public.validate_promo_code(p_code text,p_plan_key text,p_amount_usd numeric,p_user_id uuid default auth.uid())
returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if exists(select 1 from public.promo_codes where upper(btrim(code))=upper(btrim(p_code)) and benefit_type is not null) then
  return jsonb_build_object('valid',false,'reason','Use the new promotion checkout for this code.');
 end if;
 return public.validate_legacy_promo_code(p_code,p_plan_key,p_amount_usd,p_user_id);
end $$;
revoke all on function public.validate_promo_code(text,text,numeric,uuid) from public,anon;
grant execute on function public.validate_promo_code(text,text,numeric,uuid) to authenticated,service_role;

create function public.assert_promo_staff(p_permission text) returns void
language plpgsql stable security definer set search_path=public as $$
begin
 if auth.uid() is null or not public.has_role(array['admin','super_admin']) or not public.has_permission(p_permission)
 then raise exception 'Not authorized'; end if;
end $$;
revoke all on function public.assert_promo_staff(text) from public,anon,authenticated;

-- Same immutable catalog/version as _shared/subscription-prices.js.
-- Exact plan name, USD price AND duration must match; arbitrary client values
-- or a changed admin-configured product cannot silently become a different plan.
create function public.access_checkout_price(p_plan uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare product public.payment_plans; usd integer; days integer; catalog_key text;
begin
 select * into product from public.payment_plans where id=p_plan and is_active;
 case product.name
 when '30-Day Pass' then usd:=1900; days:=30; catalog_key:='thirty_day';
 when '90-Day Success Plan' then usd:=4900; days:=90; catalog_key:='ninety_day';
 when '180-Day Master Plan' then usd:=7900; days:=180; catalog_key:='master_180';
 when '365-Day Faculty Pass' then usd:=12900; days:=365; catalog_key:='faculty_365';
 else raise exception 'Plan unavailable';
 end case;
 if product.price_usd*100<>usd or product.duration_days<>days then raise exception 'Plan configuration mismatch'; end if;
 return jsonb_build_object('plan_id',product.id,'plan_name',product.name,'plan_key',catalog_key,
  'duration_days',days,'original_usd_minor',usd,'original_minor',(usd::bigint*1134+50)/100,
  'currency','GHS','price_version','existing-plans-ghs-11.34-v1');
end $$;
revoke all on function public.access_checkout_price(uuid) from public,anon,authenticated;

create function public.admin_save_promotion(p_id uuid,p_revision integer,p_config jsonb) returns uuid
language plpgsql security definer set search_path=public as $$
declare previous public.promo_codes; saved public.promo_codes; normalized text; kind text; units integer;
 starts timestamptz; finishes timestamptz; max_total integer; per_user integer; minimum integer; restricted uuid;
begin
 perform public.assert_promo_staff(case when p_id is null then 'promo.create' else 'promo.edit' end);
 if p_config is null or jsonb_typeof(p_config)<>'object' or exists(select 1 from jsonb_object_keys(p_config) k
  where k not in ('code','name','description','benefit_type','benefit_units','starts_at','expires_at','max_uses',
  'per_user_limit','minimum_ghs_minor','plan_id','new_users_only')) then raise exception 'Invalid promotion'; end if;
 normalized:=upper(btrim(p_config->>'code')); kind:=p_config->>'benefit_type'; units:=(p_config->>'benefit_units')::integer;
 starts:=(p_config->>'starts_at')::timestamptz; finishes:=(p_config->>'expires_at')::timestamptz;
 max_total:=(p_config->>'max_uses')::integer; per_user:=(p_config->>'per_user_limit')::integer;
 minimum:=(p_config->>'minimum_ghs_minor')::integer; restricted:=(p_config->>'plan_id')::uuid;
 if normalized is null or normalized !~ '^[A-Z0-9][A-Z0-9_-]{2,63}$' or
  coalesce(length(btrim(p_config->>'name')),0) not between 1 and 150 or length(p_config->>'description')>2000 or
  kind is null or kind not in ('percentage_discount','fixed_discount','free_access_days') or units is null or units<=0 or
  (kind='percentage_discount' and units>10000) or (kind='free_access_days' and units>3650) or
  starts is null or finishes is null or not isfinite(starts) or not isfinite(finishes) or finishes<=starts or
  (max_total is not null and max_total<1) or per_user is null or per_user<1 or minimum is null or minimum<0 or
  jsonb_typeof(p_config->'new_users_only') is distinct from 'boolean'
 then raise exception 'Invalid promotion'; end if;
 if restricted is not null then perform public.access_checkout_price(restricted); end if;
 if p_id is not null then
  select * into previous from public.promo_codes where id=p_id and benefit_type is not null for update;
  if not found then raise exception 'Promotion not found'; end if;
  if p_revision is distinct from previous.revision then raise exception 'Promotion changed; reload'; end if;
  if exists(select 1 from public.promo_redemptions where promo_id=p_id) then
   raise exception 'Used promotion is immutable; duplicate instead';
  end if;
  update public.promo_codes set code=normalized,name=btrim(p_config->>'name'),description=p_config->>'description',
   benefit_type=kind,benefit_units=units,valid_from=starts,expires_at=finishes,max_uses=max_total,max_per_user=per_user,
   minimum_ghs_minor=minimum,restricted_plan_id=restricted,
   eligibility=case when (p_config->>'new_users_only')::boolean then 'new_users' else 'all' end,revision=revision+1
  where id=p_id returning * into saved;
 else
  insert into public.promo_codes(code,name,description,benefit_type,benefit_units,valid_from,expires_at,max_uses,max_per_user,
   minimum_ghs_minor,restricted_plan_id,eligibility,is_active,created_by)
  values(normalized,btrim(p_config->>'name'),p_config->>'description',kind,units,starts,finishes,max_total,per_user,minimum,restricted,
   case when (p_config->>'new_users_only')::boolean then 'new_users' else 'all' end,false,auth.uid()) returning * into saved;
 end if;
 insert into public.admin_audit_logs(admin_id,action,target_table,target_id,details)
 values(auth.uid(),case when p_id is null then 'PROMO_CREATED' else 'PROMO_UPDATED' end,'promo_codes',saved.id,
  jsonb_build_object('before',to_jsonb(previous),'after',to_jsonb(saved)));
 return saved.id;
end $$;

create function public.admin_set_promotion_status(p_id uuid,p_action text,p_revision integer) returns void
language plpgsql security definer set search_path=public as $$
declare promo public.promo_codes;
begin
 perform public.assert_promo_staff('promo.pause');
 if p_action is null or p_action not in ('pause','resume','end') then raise exception 'Invalid promotion action'; end if;
 select * into promo from public.promo_codes where id=p_id and benefit_type is not null for update;
 if not found then raise exception 'Promotion not found'; end if;
 if promo.revision is distinct from p_revision then raise exception 'Promotion changed; reload'; end if;
 if p_action='resume' and promo.expires_at<=now() then raise exception 'Promotion expired'; end if;
 update public.promo_codes set is_active=p_action='resume',
  expires_at=case when p_action='end' then least(expires_at,now()) else expires_at end,revision=revision+1 where id=p_id;
 insert into public.admin_audit_logs(admin_id,action,target_table,target_id,details)
 values(auth.uid(),case p_action when 'pause' then 'PROMO_PAUSED' when 'resume' then 'PROMO_RESUMED' else 'PROMO_ENDED' end,
  'promo_codes',p_id,jsonb_build_object('revision',promo.revision+1));
end $$;

-- Caller must lock the recipient, then promo row before consuming this quote.
-- Preview uses the same logic without writes; the quote is not a reservation.
create function public.quote_access_promotion(p_user uuid,p_plan uuid,p_code text) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare promo public.promo_codes; price jsonb; original integer; discount integer:=0; remaining integer; used integer;
begin
 if not public.access_feature_enabled('promo_codes') then raise exception 'Promotions are paused'; end if;
 if p_user is null then raise exception 'Not authorized'; end if;
 select * into promo from public.promo_codes where upper(btrim(code))=upper(btrim(p_code)) and benefit_type is not null;
 if not found then raise exception 'Invalid promo code'; end if;
 if not promo.is_active then raise exception 'Promotion inactive'; end if;
 if promo.valid_from>now() then raise exception 'Promotion not started'; end if;
 if promo.expires_at<=now() then raise exception 'Promotion expired'; end if;
 if promo.restricted_plan_id is not null and promo.restricted_plan_id<>p_plan then raise exception 'Promotion not valid for plan'; end if;
 price:=public.access_checkout_price(p_plan); original:=(price->>'original_minor')::integer;
 if original<promo.minimum_ghs_minor then raise exception 'Minimum purchase not reached'; end if;
 select count(*),count(*) filter(where user_id=p_user) into remaining,used
 from public.promo_redemptions where promo_id=promo.id and outcome in ('reserved','completed');
 if promo.max_uses is not null and remaining>=promo.max_uses then raise exception 'Promotion limit reached'; end if;
 if used>=promo.max_per_user then raise exception 'Promotion already used'; end if;
 if promo.eligibility='new_users' and (
  exists(select 1 from public.subscriptions where user_id=p_user) or
  exists(select 1 from public.promo_redemptions where user_id=p_user and (outcome in ('reserved','completed') or status='paid')))
 then raise exception 'Promotion is for new subscribers only'; end if;
 if promo.benefit_type='percentage_discount' then discount:=((original::bigint*promo.benefit_units+5000)/10000)::integer;
 elsif promo.benefit_type='fixed_discount' then discount:=least(original,promo.benefit_units);
 end if;
 return price||jsonb_build_object('promo_id',promo.id,'code',promo.code,'benefit_type',promo.benefit_type,
  'benefit_units',promo.benefit_units,'discount_minor',discount,'final_minor',
  case when promo.benefit_type='free_access_days' then 0 else original-discount end);
end $$;
revoke all on function public.quote_access_promotion(uuid,uuid,text) from public,anon,authenticated;

create function public.preview_access_promotion(p_plan uuid,p_code text) returns jsonb
language sql stable security definer set search_path=public as $$
 select public.quote_access_promotion(auth.uid(),p_plan,p_code);
$$;

create function public.redeem_access_promotion(p_plan uuid,p_code text,p_request uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid(); prior public.promo_redemptions; payload jsonb; quote jsonb; promo uuid;
 grant_row public.access_grants; redemption uuid:=gen_random_uuid(); starts timestamptz; ends timestamptz; days integer;
begin
 if actor is null or p_request is null then raise exception 'Not authorized'; end if;
 -- Same recipient lock as admin grants: no overlapping admin/promo race.
 perform 1 from public.profiles where id=actor for update;
 if not found then raise exception 'Not authorized'; end if;
 payload:=jsonb_build_object('plan',p_plan,'code',upper(btrim(p_code)));
 select * into prior from public.promo_redemptions where user_id=actor and request_key=p_request;
 if found then
  if prior.request_payload<>payload then raise exception 'Idempotency conflict'; end if;
  return jsonb_build_object('redemption_id',prior.id,'grant_id',prior.access_grant_id,'outcome',prior.outcome,'label',
   case when prior.discount_ghs_minor>0 then 'Fully Discounted' else 'Promo Access' end);
 end if;
 if not public.access_feature_enabled('complimentary_access') then raise exception 'Complimentary access is disabled'; end if;
 select id into promo from public.promo_codes where upper(btrim(code))=upper(btrim(p_code)) and benefit_type is not null for update;
 quote:=public.quote_access_promotion(actor,p_plan,p_code);
 if (quote->>'final_minor')::integer<>0 then raise exception 'Payment required'; end if;
 days:=case when quote->>'benefit_type'='free_access_days' then (quote->>'benefit_units')::integer
  else (quote->>'duration_days')::integer end;
 select greatest(now(),coalesce(max(expires_at),now())) into starts from public.access_grants
 where user_id=actor and revoked_at is null;
 ends:=starts+make_interval(days=>days);
 insert into public.access_grants(user_id,plan_id,plan_key,grant_type,starts_at,expires_at,status,reason,promo_code_id,
  created_by,request_key,request_payload,metadata)
 values(actor,p_plan,public.access_plan_key(quote->>'plan_name'),'promo_code',starts,ends,
  case when starts>now() then 'scheduled' else 'active' end,'Promotion '||(quote->>'code'),promo,
  actor,p_request,payload,jsonb_build_object('redemption_id',redemption,'confirmation','no_payment'))
 returning * into grant_row;
 insert into public.promo_redemptions(id,promo_id,user_id,plan_key,plan_name,status,access_grant_id,request_key,request_payload,
  outcome,original_ghs_minor,discount_ghs_minor,final_ghs_minor,metadata)
 values(redemption,promo,actor,quote->>'plan_key',quote->>'plan_name','applied',grant_row.id,p_request,payload,
  'completed',(quote->>'original_minor')::integer,(quote->>'discount_minor')::integer,0,
  jsonb_build_object('confirmation','no_payment','price_version',quote->>'price_version'));
 update public.promo_codes set used_count=used_count+1 where id=promo;
 insert into public.access_grant_events(access_grant_id,actor_id,target_user_id,action,new_values,reason)
 values(grant_row.id,actor,actor,'ACCESS_GRANTED',to_jsonb(grant_row),grant_row.reason);
 insert into public.admin_audit_logs(admin_id,action,target_table,target_id,details)
 values(actor,'PROMO_REDEEMED','promo_redemptions',redemption,
  jsonb_build_object('promo_id',promo,'grant_id',grant_row.id,'amount_paid',0,'confirmation','no_payment'));
 perform public.emit_access_notice(actor,'grant:'||grant_row.id||':ACCESS_GRANTED','Promo access confirmed',
  'Complimentary access starts '||starts::text||' and ends '||ends::text||'. No payment was taken.',true);
 return jsonb_build_object('redemption_id',redemption,'grant_id',grant_row.id,'outcome','completed',
  'label',case when (quote->>'discount_minor')::integer>0 then 'Fully Discounted' else 'Promo Access' end);
end $$;

create function public.admin_list_promotions(p_page integer default 0) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare result jsonb;
begin
 perform public.assert_promo_staff('promo.view');
 if p_page is null or p_page not between 0 and 20000 then raise exception 'Invalid page'; end if;
 with base as (select p.*,case when expires_at<=now() then 'expired' when not is_active then 'paused'
  when valid_from>now() then 'scheduled' else 'active' end as effective_status,
  (select count(*) from public.promo_redemptions r where r.promo_id=p.id and r.outcome='completed') as completed
  from public.promo_codes p where benefit_type is not null),
 page_rows as (select * from base order by created_at desc,id limit 25 offset p_page*25)
 select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(p)) from page_rows p),'[]'::jsonb),
  'total',(select count(*) from base),'active',(select count(*) from base where effective_status='active'),
  'scheduled',(select count(*) from base where effective_status='scheduled'),'expired',(select count(*) from base where effective_status='expired'),
  'redemptions',(select count(*) from public.promo_redemptions where outcome='completed'),
  'discount_minor',(select coalesce(sum(discount_ghs_minor),0) from public.promo_redemptions where outcome='completed'),
  'complimentary',(select count(*) from public.promo_redemptions where outcome='completed' and access_grant_id is not null))
 into result;
 return result;
end $$;

create function public.admin_promotion_redemptions(p_promo uuid,p_page integer default 0) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare result jsonb;
begin
 perform public.assert_promo_staff('promo.view_redemptions');
 if p_page is null or p_page not between 0 and 20000 then raise exception 'Invalid page'; end if;
 with base as (select r.id,r.promo_id,r.user_id,p.full_name,p.email,r.plan_name,r.outcome,r.original_ghs_minor,
  r.discount_ghs_minor,r.final_ghs_minor,r.access_grant_id,r.redeemed_at
  from public.promo_redemptions r join public.profiles p on p.id=r.user_id where r.promo_id=p_promo and r.outcome is not null),
 page_rows as (select * from base order by redeemed_at desc,id limit 25 offset p_page*25)
 select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(r)) from page_rows r),'[]'::jsonb),
  'total',(select count(*) from base)) into result;
 return result;
end $$;

revoke all on function public.admin_save_promotion(uuid,integer,jsonb),
 public.admin_set_promotion_status(uuid,text,integer),public.preview_access_promotion(uuid,text),
 public.redeem_access_promotion(uuid,text,uuid),public.admin_list_promotions(integer),
 public.admin_promotion_redemptions(uuid,integer) from public,anon;
grant execute on function public.admin_save_promotion(uuid,integer,jsonb),
 public.admin_set_promotion_status(uuid,text,integer),public.preview_access_promotion(uuid,text),
 public.redeem_access_promotion(uuid,text,uuid),public.admin_list_promotions(integer),
 public.admin_promotion_redemptions(uuid,integer) to authenticated;
commit;
