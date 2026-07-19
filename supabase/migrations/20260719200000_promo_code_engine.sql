-- Promotion engine for NurseFaculty billing.

alter table public.promo_codes
  add column if not exists name text,
  add column if not exists description text,
  add column if not exists discount_type text not null default 'percentage'
    check (discount_type in ('percentage', 'fixed_amount', 'free_trial', 'free_upgrade')),
  add column if not exists discount_value numeric(10,2),
  add column if not exists discount_amount numeric(10,2),
  add column if not exists currency text not null default 'USD',
  add column if not exists applies_to_plans text[] not null default '{}'::text[],
  add column if not exists valid_from timestamptz,
  add column if not exists max_per_user integer not null default 1,
  add column if not exists eligibility text not null default 'all'
    check (eligibility in ('all', 'new_users', 'existing_users')),
  add column if not exists institution_name text,
  add column if not exists country text,
  add column if not exists minimum_purchase_usd numeric(10,2),
  add column if not exists trial_days integer,
  add column if not exists upgrade_plan_key text,
  add column if not exists views_count integer not null default 0,
  add column if not exists applied_count integer not null default 0,
  add column if not exists successful_payments_count integer not null default 0,
  add column if not exists revenue_generated_usd numeric(12,2) not null default 0,
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

update public.promo_codes
set
  discount_type = coalesce(discount_type, 'percentage'),
  discount_value = coalesce(discount_value, discount_amount, discount_pct::numeric),
  discount_amount = coalesce(discount_amount, discount_pct::numeric),
  max_per_user = coalesce(max_per_user, 1),
  name = coalesce(name, code)
where discount_value is null
   or discount_amount is null
   or name is null;

create table if not exists public.promo_redemptions (
  id uuid primary key default gen_random_uuid(),
  promo_id uuid not null references public.promo_codes(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  invoice_id uuid references public.invoices(id) on delete set null,
  plan_key text,
  plan_name text,
  original_amount_usd numeric(10,2) not null default 0,
  discount_amount_usd numeric(10,2) not null default 0,
  final_amount_usd numeric(10,2) not null default 0,
  status text not null default 'applied'
    check (status in ('applied', 'paid', 'cancelled', 'failed', 'refunded')),
  provider text,
  provider_reference text,
  metadata jsonb not null default '{}'::jsonb,
  redeemed_at timestamptz not null default now()
);

create index if not exists idx_promo_codes_code on public.promo_codes (upper(code));
create index if not exists idx_promo_codes_active_dates on public.promo_codes (is_active, valid_from, expires_at);
create index if not exists idx_promo_redemptions_user_promo on public.promo_redemptions (user_id, promo_id, status);
create index if not exists idx_promo_redemptions_promo_status on public.promo_redemptions (promo_id, status, redeemed_at desc);

alter table public.promo_redemptions enable row level security;

drop policy if exists "promo_redemptions_owner_or_finance" on public.promo_redemptions;
create policy "promo_redemptions_owner_or_finance"
on public.promo_redemptions
for select
to authenticated
using (
  user_id = auth.uid()
  or public.has_role(array['finance', 'admin', 'super_admin'])
);

drop policy if exists "promo_redemptions_finance_write" on public.promo_redemptions;
create policy "promo_redemptions_finance_write"
on public.promo_redemptions
for all
to authenticated
using (public.has_role(array['finance', 'admin', 'super_admin']))
with check (public.has_role(array['finance', 'admin', 'super_admin']));

drop function if exists public.validate_promo_code(text, text, numeric);
drop function if exists public.validate_promo_code(text, text, numeric, uuid);

create or replace function public.validate_promo_code(
  p_code text,
  p_plan_key text,
  p_amount_usd numeric,
  p_user_id uuid default auth.uid()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  promo public.promo_codes%rowtype;
  user_redemptions integer := 0;
  has_subscription boolean := false;
  amount numeric(10,2) := greatest(coalesce(p_amount_usd, 0), 0);
  discount numeric(10,2) := 0;
  final_amount numeric(10,2) := amount;
begin
  select * into promo
  from public.promo_codes
  where upper(code) = upper(trim(p_code))
  limit 1;

  if promo.id is null then
    return jsonb_build_object('valid', false, 'reason', 'Promo code does not exist.');
  end if;

  if not promo.is_active then
    return jsonb_build_object('valid', false, 'reason', 'Promo code is inactive.');
  end if;

  if promo.valid_from is not null and promo.valid_from > now() then
    return jsonb_build_object('valid', false, 'reason', 'Promo code is not active yet.');
  end if;

  if promo.expires_at is not null and promo.expires_at < now() then
    return jsonb_build_object('valid', false, 'reason', 'Promo code has expired.');
  end if;

  if promo.max_uses is not null and promo.used_count >= promo.max_uses then
    return jsonb_build_object('valid', false, 'reason', 'Promo code redemption limit has been reached.');
  end if;

  if array_length(promo.applies_to_plans, 1) is not null
     and not exists (
       select 1
       from unnest(promo.applies_to_plans) as allowed_plan
       where lower(allowed_plan) = lower(trim(p_plan_key))
     ) then
    return jsonb_build_object('valid', false, 'reason', 'Promo code is not valid for this subscription plan.');
  end if;

  if promo.minimum_purchase_usd is not null and amount < promo.minimum_purchase_usd then
    return jsonb_build_object('valid', false, 'reason', 'Promo code requires a higher purchase amount.');
  end if;

  if p_user_id is not null then
    select count(*) into user_redemptions
    from public.promo_redemptions
    where promo_id = promo.id
      and user_id = p_user_id
      and status in ('applied', 'paid');

    if promo.max_per_user is not null and user_redemptions >= promo.max_per_user then
      return jsonb_build_object('valid', false, 'reason', 'You have already used this promo code.');
    end if;

    select exists (
      select 1 from public.subscriptions
      where user_id = p_user_id
        and status in ('active', 'trialing', 'past_due', 'cancelled')
    ) into has_subscription;

    if promo.eligibility = 'new_users' and has_subscription then
      return jsonb_build_object('valid', false, 'reason', 'Promo code is only for new subscribers.');
    end if;

    if promo.eligibility = 'existing_users' and not has_subscription then
      return jsonb_build_object('valid', false, 'reason', 'Promo code is only for existing subscribers.');
    end if;
  end if;

  if promo.discount_type = 'percentage' then
    discount := round(amount * least(coalesce(promo.discount_value, promo.discount_pct, 0), 100) / 100, 2);
  elsif promo.discount_type = 'fixed_amount' then
    discount := least(amount, coalesce(promo.discount_value, promo.discount_amount, 0));
  elsif promo.discount_type = 'free_trial' then
    discount := 0;
  elsif promo.discount_type = 'free_upgrade' then
    discount := 0;
  end if;

  final_amount := greatest(amount - discount, 0);

  update public.promo_codes
  set applied_count = applied_count + 1
  where id = promo.id;

  return jsonb_build_object(
    'valid', true,
    'promo_id', promo.id,
    'code', promo.code,
    'name', coalesce(promo.name, promo.code),
    'discount_type', promo.discount_type,
    'discount_value', coalesce(promo.discount_value, promo.discount_amount, promo.discount_pct::numeric),
    'trial_days', promo.trial_days,
    'upgrade_plan_key', promo.upgrade_plan_key,
    'original_amount_usd', amount,
    'discount_amount_usd', discount,
    'final_amount_usd', final_amount,
    'message',
      case
        when promo.discount_type = 'free_trial' then coalesce(promo.trial_days, 0)::text || ' days free trial applied.'
        when promo.discount_type = 'free_upgrade' then 'Free upgrade applied.'
        else 'Promo code applied successfully.'
      end
  );
end;
$$;

grant select on public.promo_redemptions to authenticated;
grant insert, update, delete on public.promo_redemptions to authenticated;
grant execute on function public.validate_promo_code(text, text, numeric, uuid) to authenticated;
