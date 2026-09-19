-- Sends authenticated HTTP invocations only while the master switch is paused.
-- Credentials stay inside PostgreSQL; only request IDs are returned.
do $$ begin
 if (select enabled from public.daily_email_config where id) is distinct from false then
  raise exception 'Paused state required';
 end if;
 if (select decrypted_secret from vault.decrypted_secrets where name='daily_email_project_url')
    is distinct from 'https://mcbfqgyosdklnzbagobp.supabase.co' then
  raise exception 'Unexpected project URL';
 end if;
end $$;
select net.http_post(
 url := 'https://mcbfqgyosdklnzbagobp.supabase.co/functions/v1/daily-question-email',
 headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',
 (select decrypted_secret from vault.decrypted_secrets where name='daily_email_cron_secret')),
 body := '{}'::jsonb, timeout_milliseconds := 60000
) as request_id from generate_series(1,3);
