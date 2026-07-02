-- Admins manage the complete question bank; reviewers can read all items for review.
drop policy if exists "questions_admin_write" on public.questions;
create policy "questions_admin_write" on public.questions
  for all to authenticated
  using (public.has_role(array['admin', 'super_admin']))
  with check (public.has_role(array['admin', 'super_admin']));

drop policy if exists "questions_reviewer_read_all" on public.questions;
create policy "questions_reviewer_read_all" on public.questions
  for select to authenticated
  using (public.has_role(array['content_reviewer']));
