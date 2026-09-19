// Real PostgreSQL sessions, synthetic records only. No host mounts, ports or network.
// Requires Docker and the already-used Supabase PostgreSQL image locally.
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test } from 'node:test';

function docker(args, input = '') {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    let output = '', errors = '';
    child.stdout.on('data', value => { output += value; });
    child.stderr.on('data', value => { errors += value; });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(output.trim()) : reject(new Error(errors || output || `Docker exit ${code}`)));
    child.stdin.on('error', () => {});
    child.stdin.end(input);
  });
}

test('independent PostgreSQL sessions serialize grant retries and duration limits', { timeout: 90000 }, async t => {
  const name = `nclex-access-test-${randomUUID()}`;
  let container;
  const admin = '00000000-0000-4000-8000-000000000001';
  const student = '00000000-0000-4000-8000-000000000002';
  const plan = '00000000-0000-4000-8000-000000000003';
  try {
    container = await docker(['run', '--detach', '--rm', '--network', 'none', '--user', 'postgres',
      '--name', name, '--label', 'com.nursefaculty.test=access-grants', '--tmpfs', '/tmp:rw,mode=1777',
      '--entrypoint', 'sh', 'public.ecr.aws/supabase/postgres:17.6.1.167', '-c',
      "initdb -D /tmp/access-grants-pg -U postgres -A trust --no-locale >/dev/null && exec postgres -D /tmp/access-grants-pg -k /tmp -c listen_addresses='' -c fsync=off"]);
    assert.match(container, /^[a-f0-9]{64}$/);
    const sql = input => docker(['exec', '-i', container, 'psql', '-h', '/tmp', '-U', 'postgres', '-d', 'postgres', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], input);
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      try { await sql('select 1;'); ready = true; break; }
      catch { await new Promise(resolve => setTimeout(resolve, 250)); }
    }
    assert.equal(ready, true, 'isolated database startup');
    await sql(`
      create role anon; create role authenticated;
      create schema auth;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
      create table profiles(id uuid primary key);
      create table roles(id uuid primary key default gen_random_uuid(),name text);
      create table permissions(id text primary key,group_key text,label text);
      create table role_permissions(role_id uuid,permission_id text,primary key(role_id,permission_id));
      create table payment_plans(id uuid primary key,name text,is_active boolean);
      create table promo_codes(id uuid primary key);
      create table subscriptions(id uuid primary key,user_id uuid,plan_name text,status text,current_period_end timestamptz,created_at timestamptz);
      create function public.has_role(text[]) returns boolean language sql stable as $$
       select auth.uid()='${admin}'::uuid and 'admin'=any($1) $$;
      create function public.has_permission(text) returns boolean language sql stable as $$ select auth.uid()='${admin}'::uuid $$;
      insert into profiles values('${admin}'),('${student}');
      insert into roles(name) values('admin'),('super_admin');
      insert into payment_plans values('${plan}','180-Day Master Plan',true);
    `);
    await sql(await readFile(new URL('../supabase/migrations/20260919200000_access_grant_foundation.sql', import.meta.url), 'utf8'));
    const create = (key, start = 1, end = 21, reason = 'Fixture') => `
      select public.admin_grant_access('${student}','${plan}',
       date_trunc('day',now())+interval '${start} days',date_trunc('day',now())+interval '${end} days',
       '${reason}',null,'${key}');`;
    const asAdmin = input => `begin; set local role authenticated; set local test.uid='${admin}'; ${input} commit;`;
    const count = async table => Number(await sql(`select count(*) from ${table};`));
    await t.test('duplicate network retry returns one grant and one audit event', async () => {
      const key = randomUUID();
      // Hold the recipient lock in session A while session B submits the same request.
      const a = sql(asAdmin(`${create(key)} select pg_sleep(0.4);`));
      const b = sql(asAdmin(create(key)));
      const results = await Promise.all([a, b]);
      assert.equal(results[0].trim(), results[1].trim());
      assert.equal(await count('access_grants'), 1);
      assert.equal(await count('access_grant_events'), 1);
    });
    await t.test('different overlapping requests cannot create a second grant', async () => {
      const results = await Promise.allSettled([sql(asAdmin(create(randomUUID()))), sql(asAdmin(create(randomUUID())))]);
      assert.equal(results.filter(result => result.status === 'rejected').length, 2);
      assert.equal(await count('access_grants'), 1);
    });
    await t.test('concurrent disjoint grants cannot exceed cumulative admin cap', async () => {
      // Existing 20 days + either new 10 days is allowed, but both would be 40.
      const results = await Promise.allSettled([
        sql(asAdmin(create(randomUUID(), 21, 31))), sql(asAdmin(create(randomUUID(), 31, 41))),
      ]);
      assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
      assert.match(results.find(result => result.status === 'rejected').reason.message, /Admin duration limit/);
      assert.equal(await count('access_grants'), 2);
      assert.equal(await count('access_grant_events'), 2);
    });
    await t.test('audit failure rolls back the grant transaction', async () => {
      await sql(`create function fail_test_audit() returns trigger language plpgsql as $$ begin raise exception 'Fixture audit failure'; end $$;
       create trigger fail_test_audit before insert on access_grant_events for each row execute function fail_test_audit();
       create or replace function public.has_role(text[]) returns boolean language sql stable as $$ select auth.uid()='${admin}'::uuid $$;`);
      await assert.rejects(sql(asAdmin(create(randomUUID(), 51, 61))), /Fixture audit failure/);
      assert.equal(await count('access_grants'), 2);
      assert.equal(await count('access_grant_events'), 2);
    });
  } finally {
    // Only the exact disposable container created above; --rm removes its synthetic data.
    if (container && /^[a-f0-9]{64}$/.test(container)) await docker(['stop', '--time', '1', container]);
  }
});
