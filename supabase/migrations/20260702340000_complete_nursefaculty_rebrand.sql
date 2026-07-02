-- Complete the live user-facing rebrand.
update public.announcements
set
  title = replace(replace(title, 'YINGOH', 'NURSEFACULTY'), 'Yingoh', 'NurseFaculty'),
  content = replace(replace(content, 'YINGOH', 'NURSEFACULTY'), 'Yingoh', 'NurseFaculty')
where title ilike '%yingoh%'
   or content ilike '%yingoh%';

update public.promo_codes
set code = 'NURSE10'
where code = 'YINGOH10'
  and not exists (
    select 1 from public.promo_codes existing where existing.code = 'NURSE10'
  );

insert into public.announcements (title, content, audience, is_active)
select
  'Welcome to NurseFaculty',
  'NurseFaculty is your professional NCLEX preparation home. Your account, study progress, subscriptions, and learning history remain available at https://nursefaculty.org.',
  'all',
  true
where not exists (
  select 1 from public.announcements where title = 'Welcome to NurseFaculty'
);
