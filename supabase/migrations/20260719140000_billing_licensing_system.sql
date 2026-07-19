-- NurseFaculty billing and licensing management foundation.
-- Expands payments from student-only pricing into individual, educator,
-- institution, hospital, and enterprise licensing.

alter table public.payment_plans
  add column if not exists audience text not null default 'student'
    check (audience in ('student', 'educator', 'institution', 'hospital', 'enterprise')),
  add column if not exists billing_interval text not null default 'fixed_term'
    check (billing_interval in ('monthly', 'quarterly', 'annual', 'fixed_term', 'lifetime')),
  add column if not exists seat_limit integer,
  add column if not exists instructor_limit integer,
  add column if not exists classroom_limit integer,
  add column if not exists ai_chat_limit integer,
  add column if not exists ai_limit_period text not null default 'day'
    check (ai_limit_period in ('day', 'month', 'term', 'unlimited')),
  add column if not exists certificate_downloads_included boolean not null default false,
  add column if not exists institution_branding_included boolean not null default false,
  add column if not exists trial_days integer not null default 0,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

update public.payment_plans
set
  audience = case
    when lower(name) like '%faculty%' then 'educator'
    else 'student'
  end,
  billing_interval = case
    when duration_days = 30 then 'monthly'
    when duration_days = 90 then 'quarterly'
    when duration_days >= 365 and lower(name) not like '%explorer%' then 'annual'
    else 'fixed_term'
  end,
  ai_chat_limit = case
    when lower(name) like '%explorer%' then 10
    else null
  end,
  ai_limit_period = case
    when lower(name) like '%explorer%' then 'day'
    else 'unlimited'
  end,
  certificate_downloads_included = lower(name) not like '%explorer%' and lower(name) not like '%30-day%',
  institution_branding_included = lower(name) like '%faculty%',
  classroom_limit = case
    when lower(name) like '%180-day%' then 5
    when lower(name) like '%faculty%' then null
    else 0
  end
where true;

create table if not exists public.institution_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  customer_type text not null default 'institution'
    check (customer_type in ('institution', 'hospital', 'enterprise')),
  billing_email text,
  country text,
  plan_id uuid references public.payment_plans(id) on delete set null,
  plan_name text,
  seat_limit integer not null default 0,
  instructor_limit integer,
  classroom_limit integer,
  status text not null default 'active'
    check (status in ('trialing', 'active', 'past_due', 'suspended', 'cancelled')),
  current_period_start timestamptz default now(),
  current_period_end timestamptz,
  auto_renew boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.institution_license_seats (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution_accounts(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  assigned_email text,
  assigned_role text not null default 'student'
    check (assigned_role in ('student', 'instructor', 'department_admin', 'finance', 'admin')),
  status text not null default 'available'
    check (status in ('available', 'invited', 'assigned', 'disabled', 'transferred')),
  assigned_at timestamptz,
  disabled_at timestamptz,
  transferred_from uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_payment_methods (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references public.profiles(id) on delete cascade,
  institution_id uuid references public.institution_accounts(id) on delete cascade,
  method_type text not null
    check (method_type in ('mobile_money', 'card', 'paypal', 'bank_transfer', 'invoice')),
  provider text,
  label text not null,
  last4 text,
  country text,
  currency text not null default 'USD',
  is_default boolean not null default false,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (owner_user_id is not null or institution_id is not null)
);

alter table public.invoices
  add column if not exists invoice_number text,
  add column if not exists institution_id uuid references public.institution_accounts(id) on delete set null,
  add column if not exists subtotal_usd numeric(10,2),
  add column if not exists tax_usd numeric(10,2) not null default 0,
  add column if not exists discount_usd numeric(10,2) not null default 0,
  add column if not exists currency text not null default 'USD',
  add column if not exists receipt_email text,
  add column if not exists pdf_url text,
  add column if not exists provider_reference text,
  add column if not exists due_at timestamptz,
  add column if not exists paid_at timestamptz,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

update public.invoices
set
  invoice_number = coalesce(invoice_number, 'NF-' || upper(substr(id::text, 1, 8))),
  subtotal_usd = coalesce(subtotal_usd, amount_usd),
  receipt_email = coalesce(receipt_email, (select p.email from public.profiles p where p.id = invoices.user_id))
where invoice_number is null or subtotal_usd is null;

create unique index if not exists invoices_invoice_number_key
  on public.invoices(invoice_number)
  where invoice_number is not null;

create table if not exists public.billing_transactions (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references public.invoices(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  institution_id uuid references public.institution_accounts(id) on delete set null,
  amount numeric(12,2) not null,
  currency text not null default 'USD',
  provider text,
  provider_reference text,
  payment_method text,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed', 'refunded', 'cancelled')),
  paid_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.promo_codes
  add column if not exists discount_type text not null default 'percentage'
    check (discount_type in ('percentage', 'fixed_amount')),
  add column if not exists discount_amount numeric(10,2),
  add column if not exists currency text not null default 'USD',
  add column if not exists applies_to_audience text
    check (applies_to_audience in ('student', 'educator', 'institution', 'hospital', 'enterprise')),
  add column if not exists institution_id uuid references public.institution_accounts(id) on delete cascade,
  add column if not exists referral_owner_id uuid references public.profiles(id) on delete set null,
  add column if not exists recurring boolean not null default false,
  add column if not exists one_time_only boolean not null default true,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.billing_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null unique,
  setting_value jsonb not null default '{}'::jsonb,
  description text,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.billing_settings (setting_key, setting_value, description)
values
  ('free_trial', '{"enabled": true, "days": 7, "questions": 150, "ai_chats_per_day": 10}'::jsonb, 'Default free-trial restrictions'),
  ('ghana_mobile_money', '{"enabled": true, "providers": ["MTN MoMo", "Telecel Cash", "AirtelTigo Money"], "currency": "GHS"}'::jsonb, 'Ghana mobile money options'),
  ('international_cards', '{"enabled": false, "providers": ["Visa", "Mastercard"], "currency": "USD"}'::jsonb, 'International card gateway settings')
on conflict (setting_key) do update set
  setting_value = excluded.setting_value,
  description = excluded.description,
  updated_at = now();

create index if not exists idx_institution_accounts_status on public.institution_accounts(status);
create index if not exists idx_license_seats_institution_status on public.institution_license_seats(institution_id, status);
create index if not exists idx_billing_transactions_status on public.billing_transactions(status, created_at desc);
create index if not exists idx_payment_methods_owner on public.billing_payment_methods(owner_user_id, institution_id);

alter table public.institution_accounts enable row level security;
alter table public.institution_license_seats enable row level security;
alter table public.billing_payment_methods enable row level security;
alter table public.billing_transactions enable row level security;
alter table public.billing_settings enable row level security;

drop policy if exists "institution_accounts_admin_finance" on public.institution_accounts;
drop policy if exists "license_seats_admin_finance" on public.institution_license_seats;
drop policy if exists "payment_methods_owner_or_finance" on public.billing_payment_methods;
drop policy if exists "transactions_owner_or_finance" on public.billing_transactions;
drop policy if exists "transactions_finance_write" on public.billing_transactions;
drop policy if exists "billing_settings_read" on public.billing_settings;
drop policy if exists "billing_settings_admin" on public.billing_settings;

create policy "institution_accounts_admin_finance" on public.institution_accounts
  for all to authenticated using (public.has_role(array['finance', 'admin', 'super_admin']))
  with check (public.has_role(array['finance', 'admin', 'super_admin']));

create policy "license_seats_admin_finance" on public.institution_license_seats
  for all to authenticated using (public.has_role(array['finance', 'admin', 'super_admin']))
  with check (public.has_role(array['finance', 'admin', 'super_admin']));

create policy "payment_methods_owner_or_finance" on public.billing_payment_methods
  for all to authenticated using (
    owner_user_id = auth.uid()
    or public.has_role(array['finance', 'admin', 'super_admin'])
  )
  with check (
    owner_user_id = auth.uid()
    or public.has_role(array['finance', 'admin', 'super_admin'])
  );

create policy "transactions_owner_or_finance" on public.billing_transactions
  for select to authenticated using (
    user_id = auth.uid()
    or public.has_role(array['finance', 'admin', 'super_admin'])
  );
create policy "transactions_finance_write" on public.billing_transactions
  for all to authenticated using (public.has_role(array['finance', 'admin', 'super_admin']))
  with check (public.has_role(array['finance', 'admin', 'super_admin']));

create policy "billing_settings_read" on public.billing_settings
  for select to authenticated using (true);
create policy "billing_settings_admin" on public.billing_settings
  for all to authenticated using (public.has_role(array['admin', 'super_admin']))
  with check (public.has_role(array['admin', 'super_admin']));

grant select, insert, update, delete on public.institution_accounts to authenticated;
grant select, insert, update, delete on public.institution_license_seats to authenticated;
grant select, insert, update, delete on public.billing_payment_methods to authenticated;
grant select on public.billing_transactions to authenticated;
grant insert, update on public.billing_transactions to authenticated;
grant select on public.billing_settings to authenticated;
grant insert, update, delete on public.billing_settings to authenticated;

create or replace function public.get_institution_license_summary(target_institution_id uuid)
returns table (
  institution_id uuid,
  institution_name text,
  plan_name text,
  seat_limit integer,
  assigned_seats bigint,
  invited_seats bigint,
  disabled_seats bigint,
  available_seats bigint,
  status text,
  current_period_end timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    ia.id,
    ia.name,
    ia.plan_name,
    ia.seat_limit,
    count(ls.id) filter (where ls.status = 'assigned') as assigned_seats,
    count(ls.id) filter (where ls.status = 'invited') as invited_seats,
    count(ls.id) filter (where ls.status = 'disabled') as disabled_seats,
    greatest(ia.seat_limit - count(ls.id) filter (where ls.status in ('assigned', 'invited')), 0) as available_seats,
    ia.status,
    ia.current_period_end
  from public.institution_accounts ia
  left join public.institution_license_seats ls on ls.institution_id = ia.id
  where ia.id = target_institution_id
    and public.has_role(array['finance', 'admin', 'super_admin'])
  group by ia.id;
$$;

grant execute on function public.get_institution_license_summary(uuid) to authenticated;
