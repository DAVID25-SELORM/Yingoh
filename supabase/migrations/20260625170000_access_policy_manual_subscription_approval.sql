-- Access policy support for manual/offline payment approval.
-- Public students can sign up and verify email, but paid access is unlocked
-- only by a successful payment webhook or by finance/admin manual approval.

create or replace function public.has_role(role_names text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.name = any(role_names)
  );
$$;

grant execute on function public.has_role(text[]) to authenticated;

create or replace function public.admin_activate_manual_subscription(
  target_user_id uuid,
  target_plan_name text,
  target_invoice_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_plan public.payment_plans%rowtype;
  created_subscription_id uuid;
begin
  if not public.has_role(array['finance','admin','super_admin']) then
    raise exception 'Not authorized';
  end if;

  select *
  into selected_plan
  from public.payment_plans
  where lower(name) = lower(target_plan_name)
    and is_active = true
  order by sort_order
  limit 1;

  if selected_plan.id is null then
    raise exception 'Plan not found: %', target_plan_name;
  end if;

  update public.subscriptions
  set status = 'cancelled',
      updated_at = now()
  where user_id = target_user_id
    and status = 'active';

  insert into public.subscriptions (
    user_id,
    plan_name,
    status,
    provider,
    provider_reference,
    current_period_end,
    updated_at
  )
  values (
    target_user_id,
    selected_plan.name,
    'active',
    'manual',
    coalesce(target_invoice_id::text, 'manual-' || gen_random_uuid()::text),
    now() + make_interval(days => selected_plan.duration_days),
    now()
  )
  returning id into created_subscription_id;

  if target_invoice_id is not null then
    update public.invoices
    set status = 'paid',
        payment_method = coalesce(payment_method, 'manual'),
        paid_at = now()
    where id = target_invoice_id
      and user_id = target_user_id;
  end if;

  insert into public.admin_audit_logs (admin_id, action, target_table, target_id, details)
  values (
    auth.uid(),
    'manual_subscription_activated',
    'subscriptions',
    created_subscription_id,
    jsonb_build_object(
      'target_user_id', target_user_id,
      'plan_name', selected_plan.name,
      'invoice_id', target_invoice_id
    )
  );

  return created_subscription_id;
end;
$$;

grant execute on function public.admin_activate_manual_subscription(uuid, text, uuid) to authenticated;
