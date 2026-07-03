-- Remove the final legacy brand values stored in live content.
update public.forum_threads
set
  title = replace(replace(title, 'YINGOH', 'NURSEFACULTY'), 'Yingoh', 'NurseFaculty'),
  content = replace(replace(content, 'YINGOH', 'NURSEFACULTY'), 'Yingoh', 'NurseFaculty')
where title ilike '%yingoh%'
   or content ilike '%yingoh%';

update public.class_schedules
set meeting_url = replace(
  meeting_url,
  'https://meet.yingoh.com/',
  'https://meet.jit.si/nursefaculty-'
)
where meeting_url like 'https://meet.yingoh.com/%';
