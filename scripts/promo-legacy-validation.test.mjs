// Applies the FULL migration chain to an isolated synthetic PostgreSQL (no credentials, host mounts or network),
// then exercises validate_promo_code exactly as the checkout does: as a signed-in learner and as the
// service role used by create-paystack-order. Codes mirror the production list (YINGOH10, NCLEX25, NEWSTUDENT, NURSE10).
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test } from 'node:test';

function docker(args, input = '') {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    let out = '', err = '';
    child.stdout.on('data', v => { out += v; }); child.stderr.on('data', v => { err += v; });
    child.on('error', reject);
    child.on('close', code => (code === 0 ? resolve(out.trim()) : reject(new Error((out.match(/^MIGRATION .+$/gm)?.at(-1) ?? '') + '\n' + (err || out)))));
    child.stdin.on('error', () => {}); child.stdin.end(input);
  });
}
const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const LEARNER = uid(1), NEWBIE = uid(2), EXISTING = uid(3);

test('legacy promo codes validate correctly through the full migration chain', { timeout: 900000 }, async () => {
  let container;
  try {
    container = await docker(['run', '--detach', '--rm', '--network', 'none', '--user', 'postgres', '--name', 'nclex-promo-' + randomUUID(),
      '--label', 'com.nursefaculty.test=promo-legacy', '--tmpfs', '/tmp:rw,mode=1777', '--entrypoint', 'sh', 'public.ecr.aws/supabase/postgres:17.6.1.167', '-c',
      "initdb -D /tmp/pg -U postgres -A trust --no-locale >/dev/null && exec postgres -D /tmp/pg -k /tmp -c listen_addresses='' -c fsync=off"]);
    assert.match(container, /^[a-f0-9]{64}$/);
    const sql = (input, database = 'postgres') => docker(['exec', '-i', container, 'psql', '-h', '/tmp', '-U', 'postgres', '-d', database, '-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], input);
    for (let i = 0, ready = false; !ready && i < 80; i++) { try { await sql('select 1'); ready = true; } catch { await new Promise(r => setTimeout(r, 250)); } }
    await sql('create role anon;create role authenticated;create role service_role bypassrls;create database fresh;');
    await sql([
      'create schema auth;create schema extensions;',
      'alter database fresh set search_path=public,extensions;set search_path=public,extensions;',
      "create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',email_confirmed_at timestamptz,banned_until timestamptz,deleted_at timestamptz,invited_at timestamptz,encrypted_password text,last_sign_in_at timestamptz);",
      "create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;",
      "create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;",
      "create function auth.role() returns text language sql stable as $$ select current_user::text $$;",
      'grant usage on schema public,auth to authenticated,service_role;',
    ].join('\n'), 'fresh');
    const directory = new URL('../supabase/migrations/', import.meta.url);
    const files = (await readdir(directory)).filter(f => f.endsWith('.sql')).sort();
    let script = 'set client_min_messages=warning;\nset search_path=public,extensions;\n';
    for (const file of files) script += '\\echo MIGRATION ' + file + '\n' + await readFile(new URL(file, directory), 'utf8') + '\n';
    await sql(script, 'fresh');

    // Production-like data: the three starter codes + one custom code, and a learner who already subscribed.
    await sql(`
      insert into auth.users(id,email,email_confirmed_at) values('${LEARNER}','l@x.com',now()),('${NEWBIE}','n@x.com',now()),('${EXISTING}','e@x.com',now());
      insert into profiles(id,email,full_name) values('${LEARNER}','l@x.com','L'),('${NEWBIE}','n@x.com','N'),('${EXISTING}','e@x.com','E') on conflict do nothing;
      insert into subscriptions(user_id,plan_name,status,current_period_end) values('${EXISTING}','30-Day Pass','active',now()+interval '10 days');
      delete from promo_codes;
      insert into promo_codes(code,name,discount_pct,max_uses,expires_at) values
        ('NCLEX25','NCLEX25',25,100,'2026-09-22T00:00:00Z'),('NEWSTUDENT','NEWSTUDENT',50,200,'2026-07-24T00:00:00Z');
      insert into promo_codes(code,name,discount_pct) values('YINGOH10','YINGOH10',10),('NURSE10','NURSE10',10);
      insert into promo_codes(code,name,discount_type,discount_value,discount_pct,max_uses,applies_to_plans) values('ONLY90','ONLY90','percentage',20,20,1,array['ninety_day']);
      insert into promo_codes(code,name,discount_type,discount_value,max_per_user,eligibility) values('NEWONLY','NEWONLY','fixed_amount',5,1,'new_users');
      insert into promo_codes(code,name,discount_type,discount_value,minimum_purchase_usd) values('BIGSPEND','BIGSPEND','fixed_amount',5,100);
      insert into promo_codes(code,name,is_active,discount_pct) values('OFFCODE','OFFCODE',false,10);
    `, 'fresh');

    const validate = async (who, code, plan = 'thirty_day', amount = 19, asService = false) => {
      const role = asService ? 'service_role' : 'authenticated';
      const out = await sql(`set test.uid='${who ?? ''}'; set role ${role};
        select public.validate_promo_code('${code}','${plan}',${amount},${who ? `'${who}'::uuid` : 'null'})::text;`, 'fresh');
      return JSON.parse(out.split('\n').filter(l => l.startsWith('{')).at(-1));
    };

    // the codes from the production screenshot
    const yingoh = await validate(LEARNER, 'YINGOH10');
    assert.equal(yingoh.valid, true); assert.equal(yingoh.discount_amount_usd, 1.9); assert.equal(yingoh.final_amount_usd, 17.1);
    assert.equal((await validate(LEARNER, 'nurse10')).valid, true, 'lookup is case-insensitive');
    assert.equal((await validate(LEARNER, ' NURSE10 ')).valid, true, 'surrounding spaces are ignored');
    assert.deepEqual([(await validate(LEARNER, 'NCLEX25')).reason, (await validate(LEARNER, 'NEWSTUDENT')).reason], ['Promo code has expired.', 'Promo code has expired.']);
    // checkout runs the same check as the service role (create-paystack-order)
    const asService = await validate(LEARNER, 'YINGOH10', 'thirty_day', 19, true);
    assert.equal(asService.valid, true); assert.equal(asService.final_amount_usd, 17.1);
    // rules
    assert.equal((await validate(LEARNER, 'DOESNOTEXIST')).reason, 'Promo code does not exist.');
    assert.equal((await validate(LEARNER, 'OFFCODE')).reason, 'Promo code is inactive.');
    assert.equal((await validate(LEARNER, 'ONLY90', 'thirty_day')).reason, 'Promo code is not valid for this subscription plan.');
    assert.equal((await validate(LEARNER, 'ONLY90', 'ninety_day', 49)).valid, true);
    assert.equal((await validate(LEARNER, 'BIGSPEND')).reason, 'Promo code requires a higher purchase amount.');
    assert.equal((await validate(NEWBIE, 'NEWONLY')).valid, true);
    assert.equal((await validate(EXISTING, 'NEWONLY')).reason, 'Promo code is only for new subscribers.');
    // no sign-in: the learner-facing apply step needs a session, anon cannot call it at all
    await assert.rejects(sql(`set role anon; select public.validate_promo_code('YINGOH10','thirty_day',19,null);`, 'fresh'), /permission denied/);
    // a code created with the NEW promotion system is not usable in the legacy checkout
    await sql(`insert into promo_codes(code,name,discount_pct,benefit_type,benefit_units) values('NEWSTYLE','NEWSTYLE',10,'percentage_discount',1000);`, 'fresh');
    assert.equal((await validate(LEARNER, 'NEWSTYLE')).reason, 'Use the new promotion checkout for this code.');
  } finally {
    if (container && /^[a-f0-9]{64}$/.test(container)) await docker(['stop', '--time', '1', container]);
  }
});
