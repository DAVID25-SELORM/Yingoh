-- Master production controls for the 7,500-question Yingoh bank.
-- Blueprint: NCSBN 2026 NCLEX-RN Test Plan.
create table if not exists public.question_bank_targets (
  client_need text primary key,
  target_percentage numeric(5,2) not null,
  target_questions integer not null,
  official_source text not null,
  created_at timestamptz not null default now()
);

insert into public.question_bank_targets (
  client_need, target_percentage, target_questions, official_source
) values
  ('Management of Care', 18, 1350, 'https://www.ncsbn.org/public-files/2026_RN_Test-Plan_English-F.pdf'),
  ('Safety and Infection Prevention and Control', 13, 975, 'https://www.ncsbn.org/public-files/2026_RN_Test-Plan_English-F.pdf'),
  ('Health Promotion and Maintenance', 9, 675, 'https://www.ncsbn.org/public-files/2026_RN_Test-Plan_English-F.pdf'),
  ('Psychosocial Integrity', 9, 675, 'https://www.ncsbn.org/public-files/2026_RN_Test-Plan_English-F.pdf'),
  ('Basic Care and Comfort', 9, 675, 'https://www.ncsbn.org/public-files/2026_RN_Test-Plan_English-F.pdf'),
  ('Pharmacological and Parenteral Therapies', 16, 1200, 'https://www.ncsbn.org/public-files/2026_RN_Test-Plan_English-F.pdf'),
  ('Reduction of Risk Potential', 12, 900, 'https://www.ncsbn.org/public-files/2026_RN_Test-Plan_English-F.pdf'),
  ('Physiological Adaptation', 14, 1050, 'https://www.ncsbn.org/public-files/2026_RN_Test-Plan_English-F.pdf')
on conflict (client_need) do update set
  target_percentage = excluded.target_percentage,
  target_questions = excluded.target_questions,
  official_source = excluded.official_source;

create table if not exists public.question_source_registry (
  source_key text primary key,
  organization text not null,
  source_title text not null,
  source_url text not null,
  approved_domains text[] not null,
  source_scope text not null,
  is_active boolean not null default true,
  reviewed_at timestamptz not null default now()
);

insert into public.question_source_registry (
  source_key, organization, source_title, source_url, approved_domains, source_scope
) values
  (
    'ncsbn-2026-test-plan',
    'National Council of State Boards of Nursing',
    '2026 NCLEX-RN Test Plan',
    'https://www.ncsbn.org/public-files/2026_RN_Test-Plan_English-F.pdf',
    array['ncsbn.org'],
    'NCLEX blueprint, activity statements, Client Needs, item distribution, and clinical judgment'
  ),
  (
    'cdc-isolation',
    'Centers for Disease Control and Prevention',
    'Isolation Precautions Guideline',
    'https://www.cdc.gov/infection-control/hcp/isolation-precautions/index.html',
    array['cdc.gov'],
    'Standard, contact, droplet, airborne, protective-environment, and occupational precautions'
  ),
  (
    'cdc-clinical-guidance',
    'Centers for Disease Control and Prevention',
    'Clinical Guidance and Guidelines',
    'https://www.cdc.gov/healthcare-associated-infections/hcp/guidance/index.html',
    array['cdc.gov'],
    'Communicable disease, immunization, infection prevention, and public-health nursing'
  ),
  (
    'nih-medlineplus',
    'U.S. National Library of Medicine',
    'MedlinePlus Drugs and Health Topics',
    'https://medlineplus.gov/druginformation.html',
    array['medlineplus.gov', 'nih.gov', 'nlm.nih.gov'],
    'Medication safety, adverse effects, interactions, conditions, tests, and patient teaching'
  ),
  (
    'fda-drugs',
    'U.S. Food and Drug Administration',
    'Drugs at FDA and Medication Safety Communications',
    'https://www.fda.gov/drugs',
    array['fda.gov'],
    'Prescribing information, boxed warnings, safety communications, and medication administration'
  ),
  (
    'ahrq-patient-safety',
    'Agency for Healthcare Research and Quality',
    'Patient Safety Network',
    'https://psnet.ahrq.gov/',
    array['ahrq.gov'],
    'Patient safety, quality improvement, handoff, medication errors, falls, and systems practice'
  ),
  (
    'osha-healthcare',
    'Occupational Safety and Health Administration',
    'Healthcare Safety Topics',
    'https://www.osha.gov/healthcare',
    array['osha.gov'],
    'Occupational exposure, bloodborne pathogens, hazardous drugs, PPE, and workplace safety'
  )
on conflict (source_key) do update set
  organization = excluded.organization,
  source_title = excluded.source_title,
  source_url = excluded.source_url,
  approved_domains = excluded.approved_domains,
  source_scope = excluded.source_scope,
  is_active = true,
  reviewed_at = now();

alter table public.question_bank_targets enable row level security;
alter table public.question_source_registry enable row level security;

drop policy if exists "question_targets_staff_read" on public.question_bank_targets;
create policy "question_targets_staff_read" on public.question_bank_targets
  for select to authenticated
  using (public.has_role(array['content_reviewer', 'instructor', 'admin', 'super_admin']));

drop policy if exists "question_sources_staff_read" on public.question_source_registry;
create policy "question_sources_staff_read" on public.question_source_registry
  for select to authenticated
  using (public.has_role(array['content_reviewer', 'instructor', 'admin', 'super_admin']));

grant select on public.question_bank_targets to authenticated;
grant select on public.question_source_registry to authenticated;

create or replace view public.question_bank_blueprint_progress
with (security_invoker = true)
as
select
  t.client_need,
  t.target_percentage,
  t.target_questions,
  count(q.id) as current_questions,
  greatest(t.target_questions - count(q.id), 0) as remaining_questions,
  count(q.id) filter (where q.status = 'published') as published_questions,
  count(q.id) filter (where q.status = 'draft') as draft_questions
from public.question_bank_targets t
left join public.questions q on q.client_need = t.client_need
group by t.client_need, t.target_percentage, t.target_questions;

grant select on public.question_bank_blueprint_progress to authenticated;
