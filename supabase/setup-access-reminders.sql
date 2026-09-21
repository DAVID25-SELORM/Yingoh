-- OPTIONAL STAGING RECIPE ONLY. Not executed by migrations or the application.
-- Requires pg_cron already installed and the complete Access migrations applied.
-- This schedules existing in-app notifications only, NOT SMTP/email delivery.
-- Keep this job inactive until staging verification and explicit rollout approval.
begin;
do $$
declare job_id bigint;
begin
 job_id:=cron.schedule('nursefaculty-access-reminders','0 * * * *',
  'select public.process_access_reminders(100);');
 perform cron.alter_job(job_id,active:=false);
end $$;
commit;

-- Optional safe cleanup for orders never claimed for a provider request.
-- Processing/ambiguous charges are deliberately excluded.
begin;
do $$
declare job_id bigint;
begin
 job_id:=cron.schedule('nursefaculty-access-unstarted-orders','15 * * * *',
  'select public.expire_unstarted_access_payments()');
 perform cron.alter_job(job_id,active:=false);
end $$;
commit;
-- After explicit approval, an operator can activate the named job.
-- Complimentary access must also be enabled server-side; otherwise the worker
-- returns zero without creating notices. Never change paid subscriptions here.
