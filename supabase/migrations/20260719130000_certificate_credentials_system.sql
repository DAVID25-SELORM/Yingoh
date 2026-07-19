-- NurseFaculty certificate credential system.
-- Separates formal certificates, achievement badges, transcripts, templates,
-- institution branding, issuance rules, and public verification metadata.

create extension if not exists pgcrypto with schema extensions;

alter table public.user_certificates
  add column if not exists category text not null default 'achievement'
    check (category in ('academic', 'professional', 'attendance', 'achievement', 'competition', 'instructor_award')),
  add column if not exists certificate_number text,
  add column if not exists course_id uuid references public.courses(id) on delete set null,
  add column if not exists course_name text,
  add column if not exists institution_name text not null default 'NurseFaculty',
  add column if not exists instructor_name text,
  add column if not exists completion_date date,
  add column if not exists grade text,
  add column if not exists credit_hours numeric(6,2),
  add column if not exists verification_url text,
  add column if not exists qr_payload text,
  add column if not exists digital_signature text,
  add column if not exists expires_at timestamptz,
  add column if not exists status text not null default 'active'
    check (status in ('draft', 'active', 'revoked', 'expired', 'reissued')),
  add column if not exists revoked_at timestamptz,
  add column if not exists revoked_by uuid references public.profiles(id) on delete set null,
  add column if not exists revoke_reason text,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists user_certificates_certificate_number_key
  on public.user_certificates(certificate_number)
  where certificate_number is not null;

update public.user_certificates
set
  category = case
    when lower(type) in ('academic', 'course_completion', 'completion_certificate') then 'academic'
    when lower(type) in ('professional', 'ce', 'cme', 'bls', 'workshop') then 'professional'
    when lower(type) = 'attendance' then 'attendance'
    else 'achievement'
  end,
  certificate_number = coalesce(certificate_number, verification_code),
  course_name = coalesce(course_name, title),
  verification_url = coalesce(verification_url, 'https://nursefaculty.org/#/VerifyCertificate/' || verification_code),
  qr_payload = coalesce(qr_payload, 'https://nursefaculty.org/#/VerifyCertificate/' || verification_code),
  digital_signature = coalesce(digital_signature, encode(extensions.digest(id::text || ':' || verification_code, 'sha256'), 'hex'))
where verification_code is not null;

create table if not exists public.institution_branding (
  id uuid primary key default gen_random_uuid(),
  institution_name text not null default 'NurseFaculty',
  logo_url text,
  seal_url text,
  dean_signature_url text,
  department_signature_url text,
  accreditation_number text,
  footer_text text,
  certificate_number_prefix text not null default 'NF',
  theme_color text not null default '#29b7a3',
  is_default boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.certificate_templates (
  id uuid primary key default gen_random_uuid(),
  institution_branding_id uuid references public.institution_branding(id) on delete set null,
  name text not null,
  category text not null default 'academic'
    check (category in ('academic', 'professional', 'attendance', 'achievement', 'competition', 'instructor_award')),
  header_text text not null default 'Certificate of Completion',
  footer_text text,
  background_url text,
  seal_url text,
  primary_color text not null default '#29b7a3',
  signature_blocks jsonb not null default '[]'::jsonb,
  qr_position text not null default 'bottom_right',
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.certificate_rules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses(id) on delete cascade,
  template_id uuid references public.certificate_templates(id) on delete set null,
  title text not null,
  category text not null default 'academic'
    check (category in ('academic', 'professional', 'attendance', 'achievement', 'competition', 'instructor_award')),
  minimum_score numeric(5,2) default 80,
  minimum_attendance_pct numeric(5,2) default 90,
  require_all_modules boolean not null default true,
  require_final_exam boolean not null default true,
  credit_hours numeric(6,2),
  expires_after_days integer,
  auto_issue boolean not null default true,
  approval_required boolean not null default false,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transcript_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  certificate_id uuid references public.user_certificates(id) on delete set null,
  course_name text not null,
  grade text,
  credit_hours numeric(6,2),
  status text not null default 'completed'
    check (status in ('in_progress', 'completed', 'failed', 'withdrawn', 'transferred')),
  completed_at timestamptz,
  issued_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_certificates_user_category on public.user_certificates(user_id, category, issued_at desc);
create index if not exists idx_user_certificates_verification_code on public.user_certificates(verification_code);
create index if not exists idx_transcript_records_user on public.transcript_records(user_id, issued_at desc);
create index if not exists idx_certificate_rules_course on public.certificate_rules(course_id);

alter table public.institution_branding enable row level security;
alter table public.certificate_templates enable row level security;
alter table public.certificate_rules enable row level security;
alter table public.transcript_records enable row level security;

drop policy if exists "institution_branding_read" on public.institution_branding;
drop policy if exists "institution_branding_admin_all" on public.institution_branding;
drop policy if exists "certificate_templates_read" on public.certificate_templates;
drop policy if exists "certificate_templates_admin_all" on public.certificate_templates;
drop policy if exists "certificate_rules_staff_read" on public.certificate_rules;
drop policy if exists "certificate_rules_admin_all" on public.certificate_rules;
drop policy if exists "transcript_records_own_read" on public.transcript_records;
drop policy if exists "transcript_records_staff_all" on public.transcript_records;

create policy "institution_branding_read" on public.institution_branding
  for select to authenticated using (true);
create policy "institution_branding_admin_all" on public.institution_branding
  for all to authenticated using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "certificate_templates_read" on public.certificate_templates
  for select to authenticated using (is_active = true or public.is_super_admin());
create policy "certificate_templates_admin_all" on public.certificate_templates
  for all to authenticated using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "certificate_rules_staff_read" on public.certificate_rules
  for select to authenticated using (
    public.is_super_admin()
    or (course_id is not null and public.is_course_staff(course_id))
  );
create policy "certificate_rules_admin_all" on public.certificate_rules
  for all to authenticated using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "transcript_records_own_read" on public.transcript_records
  for select to authenticated using (auth.uid() = user_id);
create policy "transcript_records_staff_all" on public.transcript_records
  for all to authenticated using (
    public.is_super_admin()
    or (course_id is not null and public.is_course_staff(course_id))
  )
  with check (
    public.is_super_admin()
    or (course_id is not null and public.is_course_staff(course_id))
  );

grant select on public.institution_branding to authenticated;
grant select on public.certificate_templates to authenticated;
grant select on public.certificate_rules to authenticated;
grant select on public.transcript_records to authenticated;
grant insert, update, delete on public.institution_branding to authenticated;
grant insert, update, delete on public.certificate_templates to authenticated;
grant insert, update, delete on public.certificate_rules to authenticated;
grant insert, update, delete on public.transcript_records to authenticated;

create or replace function public.verify_certificate(p_code text)
returns table (
  certificate_id uuid,
  certificate_number text,
  verification_code text,
  title text,
  student_name text,
  course_name text,
  institution_name text,
  instructor_name text,
  completion_date date,
  issued_at timestamptz,
  expires_at timestamptz,
  credit_hours numeric,
  grade text,
  category text,
  status text,
  is_verified boolean
)
language sql
security definer
set search_path = public
as $$
  select
    uc.id,
    uc.certificate_number,
    uc.verification_code,
    uc.title,
    coalesce(p.full_name, split_part(au.email, '@', 1), 'NurseFaculty Student') as student_name,
    coalesce(uc.course_name, uc.title) as course_name,
    uc.institution_name,
    uc.instructor_name,
    uc.completion_date,
    uc.issued_at,
    uc.expires_at,
    uc.credit_hours,
    uc.grade,
    uc.category,
    uc.status,
    (uc.status = 'active' and (uc.expires_at is null or uc.expires_at > now())) as is_verified
  from public.user_certificates uc
  left join public.profiles p on p.id = uc.user_id
  left join auth.users au on au.id = uc.user_id
  where uc.verification_code = trim(p_code)
     or uc.certificate_number = trim(p_code)
  limit 1;
$$;

grant execute on function public.verify_certificate(text) to anon, authenticated;

insert into public.institution_branding (
  institution_name,
  footer_text,
  certificate_number_prefix,
  theme_color,
  is_default
)
select
  'NurseFaculty',
  'Verify this credential at nursefaculty.org.',
  'NF',
  '#29b7a3',
  true
where not exists (
  select 1 from public.institution_branding where is_default = true
);

insert into public.certificate_templates (name, category, header_text, footer_text, primary_color)
values
  ('NurseFaculty Academic Completion', 'academic', 'Certificate of Completion', 'Issued by NurseFaculty', '#2367ff'),
  ('NurseFaculty Professional Certificate', 'professional', 'Professional Certificate', 'Issued by NurseFaculty', '#8a35ff'),
  ('NurseFaculty Attendance Certificate', 'attendance', 'Certificate of Attendance', 'Issued by NurseFaculty', '#e89d23'),
  ('NurseFaculty Achievement Badge', 'achievement', 'Achievement Badge', 'Issued by NurseFaculty', '#29b7a3')
on conflict do nothing;
