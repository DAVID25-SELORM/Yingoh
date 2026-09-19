import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { dailyEmailMessage, classifySmtpFailure, runDailyEmails } from '../supabase/functions/daily-question-email/worker.js';
import { smtpConfiguration, diagnosticRecipient } from '../supabase/functions/daily-question-email/config.js';
import { dailyEmailHandler } from '../supabase/functions/daily-question-email/handler.js';

const db = new PGlite();
after(() => db.close());
const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
await db.exec(`
create role anon; create role authenticated; create role service_role bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
create function auth.role() returns text language sql stable as $$ select current_user::text $$;
grant usage on schema auth to authenticated,service_role;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz default now(),banned_until timestamptz,deleted_at timestamptz);
create table profiles(id uuid primary key references auth.users(id),full_name text,email text);
create table learning_profiles(user_id uuid primary key references profiles(id),daily_email boolean default true);
create table instructor_profiles(user_id uuid primary key,account_status text);
create table subscriptions(user_id uuid,plan_name text,status text,current_period_end timestamptz);
create table questions(id uuid primary key,topic text,question_type text,prompt text,choices jsonb,correct_answer jsonb,rationale text,status text,minimum_plan text,clinical_review_status text,strategy text,reference_url text,correct_answer_explanation text,option_explanations jsonb,immediate_response text,reference_urls jsonb,reviewed_at timestamptz);
create table daily_question_emails_sent(user_id uuid,date date,sent_at timestamptz);
create table daily_questions(id uuid,question_id uuid,date date);
create table daily_question_attempts(id uuid,user_id uuid,daily_question_id uuid,answered_at timestamptz,answer jsonb,is_correct boolean);
create function has_role(text[]) returns boolean language sql stable as $$ select coalesce(current_setting('test.admin',true),'false')='true' $$;
insert into auth.users(id,email) values('${uid(1)}','one@example.com'),('${uid(2)}','two@example.com');
insert into profiles select id,'Nurse',email from auth.users;
insert into learning_profiles values('${uid(2)}',false);
insert into subscriptions select id,'basic','active',null from profiles;
insert into questions(id,topic,question_type,prompt,choices,correct_answer,rationale,status,minimum_plan,clinical_review_status)
 values('${uid(101)}','Safety','mcq','Stem','[{"id":"a","text":"A"},{"id":"b","text":"B"}]','{"ids":["a"]}',repeat('Rationale ',12),'published','starter','approved'),
 ('${uid(102)}','Safety','sata','Stem 2','[{"id":"a","text":"A"},{"id":"b","text":"B"}]','{"ids":["a","b"]}',repeat('Rationale ',12),'published','free','legacy'),
 ('${uid(103)}','Safety','mcq','Private','[]','{}','Private rationale','draft','pro','pending');
insert into daily_questions values('${uid(201)}','${uid(101)}',current_date-2);
insert into daily_question_emails_sent values('${uid(2)}',current_date-2,now()-interval '2 days');
insert into daily_question_attempts values('${uid(202)}','${uid(2)}','${uid(201)}',now()-interval '2 days','{"ids":["a"]}',true);
`);
await db.exec(await readFile(new URL('../supabase/migrations/20260918100000_daily_email_system.sql',import.meta.url),'utf8'));
const query = async (sql, args=[]) => (await db.query(sql,args)).rows;
const rpc = async (name,args={}) => {
  const keys=Object.keys(args);
  return (await query(`select public.${name}(${keys.map((k,i)=>`${k}=>$${i+1}`).join(',')}) value`,Object.values(args)))[0].value;
};
async function reset() {
  await db.exec(`reset role; set test.admin='false'; set test.uid='${uid(1)}'; delete from daily_question_deliveries; update daily_email_config set enabled=true; update user_email_preferences set daily_question_enabled=false; update user_email_preferences set daily_question_enabled=true,daily_question_time='00:00',timezone='UTC' where user_id='${uid(1)}';`);
}
async function reserve() { await rpc('reserve_daily_emails'); return (await query('select * from daily_question_deliveries'))[0]; }

test('migration backfills defaults while preserving opt-outs; automatically creates new-user defaults', async () => {
  assert.equal((await query('select enabled from daily_email_config'))[0].enabled,false);
  const history=await query('select * from daily_question_deliveries');
  assert.equal(history.length,1); assert.equal(history[0].status,'answered'); assert.equal(history[0].is_correct,true);
  const p=await query('select * from user_email_preferences order by user_id');
  assert.equal(p[0].timezone,'Africa/Accra'); assert.equal(p[0].daily_question_time,'07:00:00'); assert.equal(p[1].daily_question_enabled,false);
  await db.exec(`insert into auth.users(id,email) values('${uid(3)}','three@example.com'); insert into profiles values('${uid(3)}','New','three@example.com');`);
  assert.equal((await query('select daily_question_enabled from user_email_preferences where user_id=$1',[uid(3)]))[0].daily_question_enabled,true);
});
test('RLS permits own settings, rejects foreign settings, protected columns and invalid zones', async () => {
  await reset(); await db.exec('set role authenticated');
  await db.exec("update user_email_preferences set daily_question_time='09:30',timezone='America/New_York'");
  assert.equal((await query('select * from user_email_preferences')).length,1);
  await assert.rejects(db.exec("update user_email_preferences set timezone='invalid/zone'"));
  await assert.rejects(db.exec("update user_email_preferences set next_due_at=now()"));
  await assert.rejects(db.exec("update daily_question_deliveries set status='sent'"));
  await db.exec('reset role');
  assert.equal((await query('select daily_question_time from user_email_preferences where user_id=$1',[uid(2)]))[0].daily_question_time,'07:00:00');
});
test('due user gets one assignment across repeated concurrent invocations', async () => {
  await reset(); await Promise.all([rpc('reserve_daily_emails'),rpc('reserve_daily_emails')]);
  assert.equal((await query('select * from daily_question_deliveries')).length,1);
  await db.exec(`update user_email_preferences set next_due_at=now()-interval '1 minute' where user_id='${uid(1)}'`);
  assert.equal((await rpc('reserve_daily_emails')).conflicts,1);
});
test('disabled and not-yet-due preferences do not reserve', async () => {
  await reset(); await db.exec("update user_email_preferences set next_due_at=now()+interval '1 hour'"); await rpc('reserve_daily_emails');
  assert.equal((await query('select * from daily_question_deliveries')).length,0);
  await db.exec('update user_email_preferences set daily_question_enabled=false'); await rpc('reserve_daily_emails');
  assert.equal((await query('select * from daily_question_deliveries')).length,0);
});
test('free, expired, banned, deleted, suspended and unverified accounts are ineligible', async () => {
  await reset();
  for (const [bad,good] of [
    ["update subscriptions set plan_name='free'","update subscriptions set plan_name='basic'"],
    ["update subscriptions set current_period_end=now()-interval '1 day'","update subscriptions set current_period_end=null"],
    ["update auth.users set banned_until=now()+interval '1 day'","update auth.users set banned_until=null"],
    ["update auth.users set deleted_at=now()","update auth.users set deleted_at=null"],
    ["update auth.users set email_confirmed_at=null","update auth.users set email_confirmed_at=now()"],
    [`insert into instructor_profiles values('${uid(1)}','suspended')`,'delete from instructor_profiles'],
  ]) { await db.exec(bad); assert.equal(await rpc('daily_email_eligible',{p_user:uid(1)}),false); await db.exec(good); }
});
test('timezone conversion handles New York DST, Accra, and local midnight', async () => {
  const [r]=await query(`select ('2026-03-08 07:00'::timestamp at time zone 'America/New_York')::text spring, ('2026-11-01 07:00'::timestamp at time zone 'America/New_York')::text fall, ('2026-09-18 00:30+00'::timestamptz at time zone 'America/New_York')::date::text local_day, ('2026-09-18 07:00'::timestamp at time zone 'Africa/Accra')::text accra`);
  assert.match(r.spring,/11:00/); assert.match(r.fall,/12:00/); assert.equal(r.local_day,'2026-09-17'); assert.match(r.accra,/07:00/);
});
test('history avoids repeats then recycles oldest; draft and premium-only questions excluded', async () => {
  await reset(); const a=await reserve();
  await db.exec("update daily_question_deliveries set scheduled_date=scheduled_date-2; update user_email_preferences set next_due_at=now()-interval '1 minute'");
  await rpc('reserve_daily_emails');
  const rows=await query('select * from daily_question_deliveries order by scheduled_date'); assert.notEqual(rows[0].question_id,rows[1].question_id);
  await db.exec("update daily_question_deliveries set scheduled_date=scheduled_date-1; update user_email_preferences set next_due_at=now()-interval '1 minute'");
  await rpc('reserve_daily_emails');
  assert.equal((await query('select * from daily_question_deliveries order by scheduled_date desc'))[0].question_id,a.question_id);
});
test('worker leases exclude overlap and stale reserved leases are recovered', async () => {
  await reset(); await reserve(); const first=await rpc('claim_daily_email'); assert.ok(first);
  assert.equal(await rpc('claim_daily_email'),null);
  await db.exec("update daily_question_deliveries set reserved_at=now()-interval '6 minutes'");
  const second=await rpc('claim_daily_email'); assert.notEqual(first.lease_token,second.lease_token);
  assert.equal(await rpc('begin_daily_email',{p_id:first.id,p_token:first.lease_token}),null);
});
test('two overlapping workers send a maximum of one email', async () => {
  await reset(); let sends=0;
  await Promise.all([1,2].map(()=>runDailyEmails({rpc,appUrl:'https://example.com',log:()=>{},send:async()=>{sends++;await new Promise(resolve=>setTimeout(resolve,30));}})));
  assert.equal(sends,1); assert.equal((await query('select status from daily_question_deliveries'))[0].status,'sent');
});
test('temporary failure retries the same reservation and question, max three attempts', async () => {
  await reset(); const d=await reserve();
  for(let i=1;i<=3;i++) {
    const c=await rpc('claim_daily_email'); await rpc('begin_daily_email',{p_id:c.id,p_token:c.lease_token});
    await rpc('finish_daily_email',{p_id:c.id,p_token:c.lease_token,p_outcome:'temporary_rejection'});
    const [row]=await query('select * from daily_question_deliveries'); assert.equal(row.id,d.id); assert.equal(row.question_id,d.question_id); assert.equal(row.retry_count,i);
    assert.equal(await rpc('claim_daily_email'),null);
    await db.exec("update daily_question_deliveries set next_attempt_at=now()-interval '1 minute'");
  }
  assert.equal(await rpc('claim_daily_email'),null);
});
test('permanent and ambiguous failures are not retried', async () => {
  for(const outcome of ['permanent_rejection','delivery_outcome_unknown']) {
    await reset(); await reserve(); const c=await rpc('claim_daily_email'); await rpc('begin_daily_email',{p_id:c.id,p_token:c.lease_token});
    await rpc('finish_daily_email',{p_id:c.id,p_token:c.lease_token,p_outcome:outcome}); assert.equal(await rpc('claim_daily_email'),null);
  }
});
test('crash after sending begins is held, delayed successful acknowledgement can be recorded', async () => {
  await reset(); await reserve(); const c=await rpc('claim_daily_email'); await rpc('begin_daily_email',{p_id:c.id,p_token:c.lease_token});
  await db.exec("update daily_question_deliveries set sending_at=now()-interval '11 minutes'");
  assert.equal(await rpc('claim_daily_email'),null);
  assert.equal((await query('select last_error from daily_question_deliveries'))[0].last_error,'delivery_outcome_unknown');
  assert.equal(await rpc('finish_daily_email',{p_id:c.id,p_token:c.lease_token,p_outcome:'sent'}),true);
  assert.equal(await rpc('claim_daily_email'),null);
});
test('answer RPC hides rationale, validates choices, grades server-side, keeps first answer and denies IDOR', async () => {
  await reset(); const d=await reserve(); await db.exec('set role authenticated');
  const before=await rpc('get_daily_delivery',{p_id:d.id}); assert.equal(before.question.correct_answer,undefined); assert.equal(before.question.rationale,undefined);
  await assert.rejects(rpc('answer_daily_delivery',{p_id:d.id,p_ids:['not-a-choice']}));
  const answered=await rpc('answer_daily_delivery',{p_id:d.id,p_ids:['a']}); assert.equal(answered.is_correct,true); assert.ok(answered.question.rationale);
  const repeat=await rpc('answer_daily_delivery',{p_id:d.id,p_ids:['b']}); assert.equal(repeat.is_correct,true);
  await db.exec(`set test.uid='${uid(2)}'`); await assert.rejects(rpc('get_daily_delivery',{p_id:d.id})); await assert.rejects(rpc('answer_daily_delivery',{p_id:d.id,p_ids:['a']}));
  await db.exec('reset role; set role anon'); await assert.rejects(rpc('get_daily_delivery',{p_id:d.id})); await db.exec('reset role');
});
test('normal users cannot run workers or reporting or change master switch; admins can', async () => {
  await reset(); await db.exec('set role authenticated');
  await assert.rejects(rpc('reserve_daily_emails')); await assert.rejects(rpc('claim_daily_email')); await assert.rejects(rpc('admin_daily_emails'));
  await db.exec('update daily_email_config set enabled=false'); await db.exec('reset role'); assert.equal((await query('select enabled from daily_email_config'))[0].enabled,true);
  await db.exec("set role authenticated; set test.admin='true'; update daily_email_config set enabled=false");
  assert.equal((await rpc('admin_daily_emails')).enabled,false); await db.exec('reset role');
});
test('global pause blocks new reservations and send authorization; resume ignores historical backlog', async () => {
  await reset(); await db.exec('update daily_email_config set enabled=false'); assert.equal((await rpc('reserve_daily_emails')).reserved,0);
  await db.exec('update daily_email_config set enabled=true'); await reserve(); const c=await rpc('claim_daily_email');
  await db.exec('update daily_email_config set enabled=false'); assert.equal(await rpc('begin_daily_email',{p_id:c.id,p_token:c.lease_token}),null);
  await db.exec("update daily_email_config set enabled=true; update daily_question_deliveries set scheduled_date=scheduled_date-1; update user_email_preferences set next_due_at=now()-interval '2 days'");
  await rpc('reserve_daily_emails'); const next=await rpc('claim_daily_email'); assert.notEqual(next.id,c.id);
});
test('legacy email opt-outs sync both ways and old worker receives nobody', async () => {
  await reset(); await db.exec(`insert into learning_profiles values('${uid(1)}',false) on conflict(user_id) do update set daily_email=false`);
  assert.equal((await query('select daily_question_enabled from user_email_preferences where user_id=$1',[uid(1)]))[0].daily_question_enabled,false);
  await db.exec(`update user_email_preferences set daily_question_enabled=true where user_id='${uid(1)}'`);
  assert.equal((await query('select daily_email from learning_profiles where user_id=$1',[uid(1)]))[0].daily_email,true);
  assert.equal((await query('select * from list_daily_question_recipients()')).length,0);
});
test('template escapes content and never includes answer data; URL only contains opaque assignment ID', () => {
  const message=dailyEmailMessage({id:uid(1),email:'x@example.com',name:'<script>',topic:'Safety',prompt:'<img src=x onerror=alert(1)>',choices:[{id:'a',text:'<b>A</b>'}],correct_answer:'SECRET',rationale:'PRIVATE'},'https://example.com');
  assert.ok(message.html.includes('&lt;img')); assert.ok(!message.html.includes('<script>')); assert.ok(!JSON.stringify(message).includes('SECRET')); assert.ok(!JSON.stringify(message).includes('PRIVATE')); assert.ok(message.html.includes('dailyDelivery='));
});
test('SMTP classification only retries definite rejections/preconnect failures', () => {
  assert.equal(classifySmtpFailure(new Error('451: temporary')),'temporary_rejection'); assert.equal(classifySmtpFailure(new Error('550: invalid recipient')),'permanent_rejection'); assert.equal(classifySmtpFailure(new Error('timeout')),'delivery_outcome_unknown');
});
test('known invalid recipient is suppressed until verified address changes', async () => {
  await reset(); await reserve(); const c=await rpc('claim_daily_email'); await rpc('begin_daily_email',{p_id:c.id,p_token:c.lease_token});
  await rpc('finish_daily_email',{p_id:c.id,p_token:c.lease_token,p_outcome:'invalid_recipient'});
  assert.equal(await rpc('daily_email_eligible',{p_user:uid(1)}),false);
  await db.exec(`update auth.users set email='new@example.com' where id='${uid(1)}'`);
  assert.equal(await rpc('daily_email_eligible',{p_user:uid(1)}),true);
  await db.exec('delete from daily_email_suppressions');
});
test('legacy profile creation never overwrites an existing opt-out; legacy updates still work', async () => {
  await reset(); await db.exec(`delete from learning_profiles where user_id='${uid(1)}'; update user_email_preferences set daily_question_enabled=false where user_id='${uid(1)}'; insert into learning_profiles(user_id) values('${uid(1)}')`);
  assert.equal((await query('select daily_email from learning_profiles where user_id=$1',[uid(1)]))[0].daily_email,false);
  await db.exec(`update learning_profiles set daily_email=true where user_id='${uid(1)}'`);
  assert.equal((await query('select daily_question_enabled from user_email_preferences where user_id=$1',[uid(1)]))[0].daily_question_enabled,true);
});
test('timezone edit cannot reserve twice on the same local date', async () => {
  await reset(); const d=await reserve();
  await db.exec(`update user_email_preferences set timezone='Africa/Accra',daily_question_time='00:01' where user_id='${uid(1)}'`);
  await rpc('reserve_daily_emails'); assert.equal((await query('select id from daily_question_deliveries'))[0].id,d.id); assert.equal((await query('select id from daily_question_deliveries')).length,1);
});
test('send authorization rechecks opt-out after reservation', async () => {
  await reset(); await reserve(); const c=await rpc('claim_daily_email');
  await db.exec(`update user_email_preferences set daily_question_enabled=false where user_id='${uid(1)}'`);
  assert.equal(await rpc('begin_daily_email',{p_id:c.id,p_token:c.lease_token}),null);
});
test('ledger write failure after accepted message never invokes send again', async () => {
  let sent=0;
  const fake=async name=>name==='reserve_daily_emails'?{}:name==='claim_daily_email'?{id:uid(1),lease_token:'x'}:name==='begin_daily_email'?{id:uid(1),email:'a@b.com',choices:[]}:Promise.reject(new Error('db down'));
  let claimed=false;
  const single=async name=>name==='claim_daily_email'?(claimed?null:(claimed=true,{id:uid(1),lease_token:'x'})):fake(name);
  await assert.rejects(runDailyEmails({rpc:single,send:async()=>{sent++;},appUrl:'https://example.com',log:()=>{}})); assert.equal(sent,1);
});

test('hosted SMTP requires implicit TLS, validates sender and never defaults to blocked 587', () => {
  const values={SMTP_HOST:'smtp.example.com',SMTP_USER:'user',SMTP_PASS:'test-only',SMTP_FROM:'sender@example.com'};
  const env=k=>values[k]??'';
  assert.equal(smtpConfiguration(env).connection.port,465); assert.equal(smtpConfiguration(env).connection.tls,true);
  values.SMTP_PORT='587'; assert.throws(()=>smtpConfiguration(env),/SMTP_PORT/); delete values.SMTP_PORT;
  values.SMTP_FROM='one@example.com,two@example.com'; assert.throws(()=>smtpConfiguration(env),/SMTP_FROM/);
});
test('diagnostic requires one explicit recipient plus deliberate send flag', () => {
  assert.equal(diagnosticRecipient(['--to','test@example.com','--send-one']),'test@example.com');
  for(const args of [[],['--to','test@example.com'],['--to','a@b.com,c@d.com','--send-one'],['--to','a@b.com\r\nBcc:x@y.com','--send-one']]) assert.throws(()=>diagnosticRecipient(args));
});
function handlerFixture(enabled) {
  let accessed=0, sent=0, runs=0;
  const logs=[];
  const env=k=>({CRON_SECRET:'test-secret',SUPABASE_URL:'https://test.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test-only'}[k]??'');
  const database=()=>{accessed++;const b={select:()=>b,eq:()=>b,single:async()=>({data:enabled===null?null:{enabled},error:null})};return{from:()=>b};};
  const handler=dailyEmailHandler({env,database,sender:()=>{sent++;return()=>{};},run:async()=>{runs++;return{};},log:e=>logs.push(e)});
  return {handler,logs,counts:()=>({accessed,sent,runs})};
}
test('HTTP endpoint rejects anonymous, wrong secret and non-POST before database access', async () => {
  const f=handlerFixture(false);
  assert.equal((await f.handler(new Request('https://example.com',{method:'POST'}))).status,401);
  assert.equal((await f.handler(new Request('https://example.com',{method:'POST',headers:{'x-cron-secret':'wrong'}}))).status,401);
  assert.equal((await f.handler(new Request('https://example.com'))).status,405);
  assert.deepEqual(f.counts(),{accessed:0,sent:0,runs:0});
});
test('authenticated paused request succeeds without SMTP configuration or any reservations', async () => {
  const f=handlerFixture(false);
  const r=await f.handler(new Request('https://example.com',{method:'POST',headers:{'x-cron-secret':'test-secret'}}));
  assert.equal(r.status,200); assert.deepEqual(await r.json(),{paused:true,due:0,reserved:0,sent:0});
  assert.deepEqual(f.counts(),{accessed:1,sent:0,runs:0});
});
test('unknown pause state fails closed without SMTP or scheduling', async () => {
  const f=handlerFixture(null);
  const r=await f.handler(new Request('https://example.com',{method:'POST',headers:{'x-cron-secret':'test-secret'}}));
  assert.equal(r.status,500); assert.equal(f.counts().runs,0); assert.equal(f.counts().sent,0);
  assert.ok(!JSON.stringify(f.logs).includes('test-secret'));
});
