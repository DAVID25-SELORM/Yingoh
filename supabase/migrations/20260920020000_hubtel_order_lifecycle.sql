begin;
-- Orders preserve immutable GHS prices. They are not invoices and never imply
-- paid access until independently verified server settlement commits.
create table public.access_payment_orders(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id),plan_id uuid not null references public.payment_plans(id),
 request_key uuid not null,request_payload jsonb not null,quote jsonb not null,
 amount_minor integer not null check(amount_minor>0),currency text not null default 'GHS' check(currency='GHS'),
 state text not null default 'pending' check(state in ('pending','processing','successful','failed','cancelled','expired')),
 phone text not null check(phone~'^233[0-9]{9}$'),channel text not null check(channel in ('mtn-gh','vodafone-gh','tigo-gh')),
 redemption_id uuid unique references public.promo_redemptions(id),
 provider_reference text unique,subscription_id uuid unique references public.subscriptions(id),
 create_attempted_at timestamptz,verification_attempted_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(user_id,request_key)
);
create index access_payment_orders_pending on public.access_payment_orders(state,created_at);
create table public.access_payment_confirmations(
 order_id uuid primary key references public.access_payment_orders(id),
 user_id uuid not null references public.profiles(id),
 plan_name text not null,promo_code text,original_minor integer not null,discount_minor integer not null,
 amount_paid_minor integer not null check(amount_paid_minor>0),currency text not null check(currency='GHS'),
 payment_method text not null default 'Hubtel',reference text not null,created_at timestamptz not null default now()
);
alter table public.access_payment_orders enable row level security;
alter table public.access_payment_confirmations enable row level security;
revoke all on public.access_payment_orders,public.access_payment_confirmations from public,anon,authenticated;
grant select on public.access_payment_confirmations to authenticated;
create policy payment_confirmation_own on public.access_payment_confirmations for select to authenticated using(user_id=auth.uid());

create function public.create_access_payment_order(p_plan uuid,p_code text,p_request uuid,p_phone text,p_channel text)
returns uuid language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid(); prior public.access_payment_orders; payload jsonb; quote jsonb; promo uuid;
 redemption uuid; order_id uuid:=gen_random_uuid();
begin
 if actor is null or p_request is null then raise exception 'Not authorized'; end if;
 if p_phone is null or p_phone !~ '^233[0-9]{9}$' or p_channel is null or p_channel not in ('mtn-gh','vodafone-gh','tigo-gh')
 then raise exception 'Invalid mobile money details'; end if;
 perform 1 from public.profiles where id=actor for update;
 if not found then raise exception 'Not authorized'; end if;
 payload:=jsonb_build_object('plan',p_plan,'code',nullif(upper(btrim(p_code)),''),'phone',p_phone,'channel',p_channel);
 select * into prior from public.access_payment_orders where user_id=actor and request_key=p_request;
 if found then
  if prior.request_payload<>payload then raise exception 'Idempotency conflict'; end if;
  return prior.id;
 end if;
 if not public.access_feature_enabled('hubtel_payments') then raise exception 'Payments are paused'; end if;
 if exists(select 1 from public.access_payment_orders where user_id=actor and state in ('pending','processing'))
 then raise exception 'An existing payment needs verification'; end if;
 if nullif(btrim(p_code),'') is not null then
  select id into promo from public.promo_codes where upper(btrim(code))=upper(btrim(p_code)) and benefit_type is not null for update;
  quote:=public.quote_access_promotion(actor,p_plan,p_code);
 else
  quote:=public.access_checkout_price(p_plan);
  quote:=quote||jsonb_build_object('discount_minor',0,'final_minor',(quote->>'original_minor')::integer);
 end if;
 if (quote->>'final_minor')::integer<=0 then raise exception 'Use complimentary redemption'; end if;
 if promo is not null then
  insert into public.promo_redemptions(promo_id,user_id,plan_key,plan_name,status,request_key,request_payload,outcome,
   original_ghs_minor,discount_ghs_minor,final_ghs_minor,provider)
  values(promo,actor,quote->>'plan_key',quote->>'plan_name','applied',p_request,payload,'reserved',
   (quote->>'original_minor')::integer,(quote->>'discount_minor')::integer,(quote->>'final_minor')::integer,'hubtel')
  returning id into redemption;
 end if;
 insert into public.access_payment_orders(id,user_id,plan_id,request_key,request_payload,quote,amount_minor,phone,channel,redemption_id)
 values(order_id,actor,p_plan,p_request,payload,quote,(quote->>'final_minor')::integer,p_phone,p_channel,redemption);
 insert into public.admin_audit_logs(admin_id,action,target_table,target_id,details)
 values(actor,'CHECKOUT_CREATED','access_payment_orders',order_id,jsonb_build_object('amount_minor',quote->'final_minor','currency','GHS'));
 return order_id;
end $$;

-- Claims are never automatically reclaimed. A lost network response is an
-- ambiguous charge, not permission to initialize a second payment.
create function public.claim_access_payment(p_order uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare payment public.access_payment_orders;
begin
 select * into payment from public.access_payment_orders where id=p_order for update;
 if not found then raise exception 'Order not found'; end if;
 if payment.state<>'pending' or payment.create_attempted_at is not null then return null; end if;
 if not public.access_feature_enabled('hubtel_payments') then raise exception 'Payments are paused'; end if;
 update public.access_payment_orders set state='processing',create_attempted_at=now(),updated_at=now() where id=p_order;
 return jsonb_build_object('id',payment.id,'amount_minor',payment.amount_minor,'currency',payment.currency,
  'phone',payment.phone,'channel',payment.channel,'description',payment.quote->>'plan_name');
end $$;

create function public.record_access_payment_reference(p_order uuid,p_reference text) returns void
language plpgsql security definer set search_path=public as $$
declare payment public.access_payment_orders;
begin
 if p_reference is null or length(p_reference) not between 1 and 200 then raise exception 'Invalid provider reference'; end if;
 select * into payment from public.access_payment_orders where id=p_order for update;
 if not found or payment.create_attempted_at is null then raise exception 'Order not found'; end if;
 if payment.provider_reference is not null and payment.provider_reference<>p_reference then raise exception 'Provider reference conflict'; end if;
 update public.access_payment_orders set provider_reference=p_reference,updated_at=now() where id=p_order;
end $$;

create function public.claim_access_payment_verification(p_order uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare payment public.access_payment_orders;
begin
 select * into payment from public.access_payment_orders where id=p_order for update;
 if not found then return null; end if;
 if payment.state<>'processing' or payment.verification_attempted_at>now()-interval '10 seconds' then return null; end if;
 update public.access_payment_orders set verification_attempted_at=now() where id=p_order;
 return jsonb_build_object('id',payment.id,'amount_minor',payment.amount_minor,'currency',payment.currency,
  'provider_reference',payment.provider_reference);
end $$;

-- Service-role only. The worker must independently query the provider and
-- match reference + gross amount + currency; browser/callback claims are not input.
create function public.settle_access_payment(p_order uuid,p_reference text,p_state text,p_amount_minor integer,p_currency text)
returns text language plpgsql security definer set search_path=public as $$
declare payment public.access_payment_orders; recipient uuid; promo uuid; subscription uuid; ends timestamptz;
begin
 select user_id into recipient from public.access_payment_orders where id=p_order;
 if recipient is null then raise exception 'Order not found'; end if;
 -- Shared canonical lock order: recipient -> promo -> order.
 perform 1 from public.profiles where id=recipient for update;
 select r.promo_id into promo from public.access_payment_orders o join public.promo_redemptions r on r.id=o.redemption_id where o.id=p_order;
 if promo is not null then perform 1 from public.promo_codes where id=promo for update; end if;
 select * into payment from public.access_payment_orders where id=p_order for update;
 if p_state is null or p_state not in ('successful','failed','expired','processing') or p_reference is null or length(p_reference) not between 1 and 200 or
  p_amount_minor is distinct from payment.amount_minor or p_currency is distinct from payment.currency or
  (payment.provider_reference is not null and payment.provider_reference<>p_reference)
 then raise exception 'Payment verification mismatch'; end if;
 if payment.state='successful' then
  if p_state<>'successful' then raise exception 'Terminal payment conflict'; end if;
  return payment.state;
 end if;
 if payment.state=p_state and p_state in ('failed','expired') then return payment.state; end if;
 if payment.state<>'processing' then raise exception 'Payment requires reconciliation'; end if;
 if p_state='processing' then return payment.state; end if;
 if p_state='successful' then
  -- Preserve existing subscriptions. Same-plan remaining paid duration is
  -- carried forward; no complimentary grant or unrelated plan is deactivated.
  select greatest(now(),coalesce(max(current_period_end),now())) into ends from public.subscriptions
  where user_id=recipient and status='active' and plan_name=payment.quote->>'plan_name' and current_period_end is not null;
  ends:=ends+make_interval(days=>(payment.quote->>'duration_days')::integer);
  insert into public.subscriptions(user_id,plan_name,status,provider,provider_reference,current_period_end)
  values(recipient,payment.quote->>'plan_name','active','hubtel',p_reference,ends) returning id into subscription;
  insert into public.access_payment_confirmations(order_id,user_id,plan_name,promo_code,original_minor,discount_minor,
   amount_paid_minor,currency,reference)
  values(p_order,recipient,payment.quote->>'plan_name',payment.quote->>'code',(payment.quote->>'original_minor')::integer,
   (payment.quote->>'discount_minor')::integer,payment.amount_minor,payment.currency,p_reference);
  if payment.redemption_id is not null then
   update public.promo_redemptions set outcome='completed',status='paid',subscription_id=subscription,provider_reference=p_reference
   where id=payment.redemption_id and outcome='reserved';
   if not found then raise exception 'Promotion reservation lost'; end if;
   update public.promo_codes set used_count=used_count+1 where id=promo;
   insert into public.admin_audit_logs(admin_id,action,target_table,target_id,details)
   values(recipient,'PROMO_REDEEMED','promo_redemptions',payment.redemption_id,jsonb_build_object('promo_id',promo,'order_id',p_order));
  end if;
  perform public.emit_access_notice(recipient,'payment:'||p_order,'Payment confirmed',
   'Your '||(payment.quote->>'plan_name')||' payment of GHS '||(payment.amount_minor::numeric/100)::text||
   ' was verified. Your receipt is available in Billing.',true);
 else
  update public.promo_redemptions set outcome='released',status='failed' where id=payment.redemption_id and outcome='reserved';
 end if;
 update public.access_payment_orders set state=p_state,provider_reference=p_reference,subscription_id=subscription,updated_at=now() where id=p_order;
 insert into public.admin_audit_logs(admin_id,action,target_table,target_id,details)
 values(recipient,case when p_state='successful' then 'PAYMENT_CONFIRMED' else 'PAYMENT_FAILED' end,
  'access_payment_orders',p_order,jsonb_build_object('state',p_state,'reference',p_reference,'amount_minor',payment.amount_minor));
 return p_state;
end $$;

create function public.my_access_payment_orders() returns jsonb
language sql stable security definer set search_path=public as $$
 select coalesce(jsonb_agg(to_jsonb(o)),'[]'::jsonb) from
 (select id,state,quote->>'plan_name' as plan_name,quote->>'code' as promo_code,
  (quote->>'original_minor')::integer as original_minor,(quote->>'discount_minor')::integer as discount_minor,
  amount_minor,currency,provider_reference,created_at from public.access_payment_orders where user_id=auth.uid()
  order by created_at desc limit 100) o;
$$;
create function public.preview_access_plan(p_plan uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Not authorized'; end if;
 return public.access_checkout_price(p_plan);
end $$;

-- Safe only for orders never claimed for a provider call. Processing orders
-- must be independently verified; elapsed time alone cannot release their slot.
create function public.expire_unstarted_access_payments() returns integer
language plpgsql security definer set search_path=public as $$
declare candidate record; payment public.access_payment_orders; promo uuid; total integer:=0;
begin
 for candidate in select id,user_id from public.access_payment_orders
  where state='pending' and created_at<now()-interval '30 minutes' order by user_id,id limit 100
 loop
  perform 1 from public.profiles where id=candidate.user_id for update;
  select r.promo_id into promo from public.access_payment_orders o join public.promo_redemptions r on r.id=o.redemption_id where o.id=candidate.id;
  if promo is not null then perform 1 from public.promo_codes where id=promo for update; end if;
  select * into payment from public.access_payment_orders where id=candidate.id for update;
  if payment.state<>'pending' or payment.create_attempted_at is not null then continue; end if;
  update public.access_payment_orders set state='expired',updated_at=now() where id=payment.id;
  update public.promo_redemptions set outcome='released',status='cancelled' where id=payment.redemption_id and outcome='reserved';
  insert into public.admin_audit_logs(admin_id,action,target_table,target_id,details)
  values(payment.user_id,'PAYMENT_FAILED','access_payment_orders',payment.id,jsonb_build_object('reason','unstarted_expiry'));
  total:=total+1;
 end loop;
 return total;
end $$;
create function public.my_promotion_confirmations() returns jsonb
language sql stable security definer set search_path=public as $$
 select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) from
 (select r.id,r.plan_name,p.code,r.original_ghs_minor,r.discount_ghs_minor,g.starts_at,g.expires_at,
  case when r.discount_ghs_minor>0 then 'Fully Discounted' else 'Promo Access' end as label,r.redeemed_at
  from public.promo_redemptions r join public.access_grants g on g.id=r.access_grant_id join public.promo_codes p on p.id=r.promo_id
  where r.user_id=auth.uid() and r.outcome='completed' and r.final_ghs_minor=0 order by r.redeemed_at desc limit 100) r;
$$;

revoke all on function public.create_access_payment_order(uuid,text,uuid,text,text),public.my_access_payment_orders(),
 public.my_promotion_confirmations(),public.preview_access_plan(uuid) from public,anon;
grant execute on function public.create_access_payment_order(uuid,text,uuid,text,text),public.my_access_payment_orders(),
 public.my_promotion_confirmations(),public.preview_access_plan(uuid) to authenticated;
revoke all on function public.claim_access_payment(uuid),public.record_access_payment_reference(uuid,text),
 public.claim_access_payment_verification(uuid),public.settle_access_payment(uuid,text,text,integer,text),
 public.expire_unstarted_access_payments() from public,anon,authenticated;
grant execute on function public.claim_access_payment(uuid),public.record_access_payment_reference(uuid,text),
 public.claim_access_payment_verification(uuid),public.settle_access_payment(uuid,text,text,integer,text),
 public.expire_unstarted_access_payments() to service_role;
commit;
