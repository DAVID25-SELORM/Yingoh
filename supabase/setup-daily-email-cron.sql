-- Enable pg_cron/pg_net and create Vault secrets daily_email_project_url and
-- daily_email_cron_secret before running. Never commit secret values.
do $$ begin
 if (select enabled from public.daily_email_config where id) is distinct from false then
   raise exception 'Daily email system must be paused before cron setup';
 end if;
 if not exists(select 1 from pg_extension where extname='pg_cron') or not exists(select 1 from pg_extension where extname='pg_net') then
   raise exception 'Required cron/network extensions are unavailable';
 end if;
 if (select count(*) from vault.decrypted_secrets where name in ('daily_email_project_url','daily_email_cron_secret') and nullif(decrypted_secret,'') is not null)<>2 then
   raise exception 'Required Vault secret names are missing or duplicated';
 end if;
end $$;
select cron.schedule('nursefaculty-daily-email','*/5 * * * *',$job$
 select net.http_post(
   url := (select decrypted_secret from vault.decrypted_secrets where name='daily_email_project_url') || '/functions/v1/daily-question-email',
   headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='daily_email_cron_secret')),
   body := '{}'::jsonb, timeout_milliseconds := 60000
 );
$job$);
