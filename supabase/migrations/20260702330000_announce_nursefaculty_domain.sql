-- Notify every user of the official production-domain change.
insert into public.announcements (
  title,
  content,
  audience,
  is_active
)
select
  'Our official home is now NurseFaculty.org',
  'Yingoh NCLEX Coaching now lives at https://nursefaculty.org. Please update your bookmark and use this official address for sign-in, password recovery, study sessions, and payments.',
  'all',
  true
where not exists (
  select 1
  from public.announcements
  where title = 'Our official home is now NurseFaculty.org'
);
