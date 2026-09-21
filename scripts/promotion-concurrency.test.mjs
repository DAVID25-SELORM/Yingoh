import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { install,admin,student,other,plan,promoConfig } from './fixtures/promotion-database.mjs';

function docker(args,input='') {
 return new Promise((resolve,reject)=>{
  const child=spawn('docker',args,{stdio:['pipe','pipe','pipe'],windowsHide:true});
  let output='',errors='';
  child.stdout.on('data',v=>{output+=v;});child.stderr.on('data',v=>{errors+=v;});
  child.on('error',reject);child.on('close',code=>code===0?resolve(output.trim()):reject(new Error(errors||output)));
  child.stdin.on('error',()=>{});child.stdin.end(input);
 });
}
test('real PostgreSQL promotion capacity and retry races',{timeout:90000},async t=>{
 let container;
 try {
  container=await docker(['run','--detach','--rm','--network','none','--user','postgres','--name','nclex-promo-test-'+randomUUID(),
   '--label','com.nursefaculty.test=promotions','--tmpfs','/tmp:rw,mode=1777','--entrypoint','sh',
   'public.ecr.aws/supabase/postgres:17.6.1.167','-c',
   "initdb -D /tmp/promo-test-pg -U postgres -A trust --no-locale >/dev/null && exec postgres -D /tmp/promo-test-pg -k /tmp -c listen_addresses='' -c fsync=off"]);
  assert.match(container,/^[a-f0-9]{64}$/);
  const sql=input=>docker(['exec','-i',container,'psql','-h','/tmp','-U','postgres','-d','postgres','-X','-qAt','-v','ON_ERROR_STOP=1'],input);
  let ready=false;for(let i=0;i<60;i++){try{await sql('select 1;');ready=true;break;}catch{await new Promise(r=>setTimeout(r,250));}}
  assert.equal(ready,true);
  await install(sql);
  await sql('update access_system_controls set complimentary_access_enabled=true,promo_codes_enabled=true');
  const asUser=(user,input)=>"begin; set local role authenticated; set local test.uid='"+user+"'; "+input+' commit;';
  const create=async config=>{
   const id=await sql(asUser(admin,"select admin_save_promotion(null,null,'"+JSON.stringify(config)+"'::jsonb);"));
   await sql(asUser(admin,"select admin_set_promotion_status('"+id+"','resume',1);"));return id;
  };
  const redeem=(user,code,key=randomUUID(),hold=false)=>sql(asUser(user,
   "select redeem_access_promotion('"+plan+"','"+code+"','"+key+"');"+(hold?'select pg_sleep(0.4);':'')));
  const count=async table=>Number(await sql('select count(*) from '+table));
  await t.test('one remaining slot: two different users, exactly one success',async()=>{
   await create(promoConfig({code:'FINALONE',max_uses:1}));
   const results=await Promise.allSettled([redeem(student,'FINALONE',randomUUID(),true),redeem(other,'FINALONE')]);
   assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
   assert.match(results.find(r=>r.status==='rejected').reason.message,/Promotion limit reached/);
   assert.equal(await count('promo_redemptions'),1);assert.equal(await count('access_grants'),1);
  });
  await t.test('duplicate concurrent request produces one grant, redemption and notification',async()=>{
   await create(promoConfig({code:'RETRY'}));const key=randomUUID();
   const before=await count('notifications');
   const results=await Promise.all([redeem(student,'RETRY',key,true),redeem(student,'RETRY',key)]);
   assert.deepEqual(JSON.parse(results[0]),JSON.parse(results[1]));
   assert.equal(await count('notifications'),before+1);
   assert.equal(await count('promo_redemptions'),2);
  });
  await t.test('different requests by one user cannot bypass per-user cap',async()=>{
   await create(promoConfig({code:'PERUSER',max_uses:100,per_user_limit:1}));
   const results=await Promise.allSettled([redeem(other,'PERUSER',randomUUID(),true),redeem(other,'PERUSER')]);
   assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
   assert.match(results.find(r=>r.status==='rejected').reason.message,/already used/);
  });
  await t.test('two different free promos append without overlapping',async()=>{
   await create(promoConfig({code:'APPENDONE'}));await create(promoConfig({code:'APPENDTWO'}));
   await Promise.all([redeem(student,'APPENDONE'),redeem(student,'APPENDTWO')]);
   assert.equal(Number(await sql("select count(*) from access_grants a join access_grants b on a.id<b.id and a.user_id=b.user_id and a.starts_at<b.expires_at and b.starts_at<a.expires_at")),0);
  });
  await t.test('payment initialization and settlement race produce one financial outcome',async()=>{
   await sql('update access_system_controls set hubtel_payments_enabled=true');
   const order=await sql(asUser(student,"select create_access_payment_order('"+plan+"',null,'"+randomUUID()+"','233200000000','mtn-gh');"));
   const asService=input=>'begin;set local role service_role;'+input+'commit;';
   const claims=await Promise.all([sql(asService("select claim_access_payment('"+order+"');select pg_sleep(0.4);")),sql(asService("select claim_access_payment('"+order+"');"))]);
   assert.equal(claims.filter(Boolean).length,1);
   const settle="select settle_access_payment('"+order+"','synthetic-"+order+"','successful',21546,'GHS');";
   await Promise.all([sql(asService(settle+'select pg_sleep(0.4);')),sql(asService(settle))]);
   assert.equal(await count('subscriptions'),1);assert.equal(await count('access_payment_confirmations'),1);
   assert.equal(Number(await sql("select count(*) from admin_audit_logs where action='PAYMENT_CONFIRMED'")),1);
  });
  await t.test('bulk duplicate request serializes one atomic batch',async()=>{
   const recipient=randomUUID();await sql("insert into profiles(id,email,full_name) values('"+recipient+"','bulk@example.test','Bulk');");
   const preview=JSON.parse(await sql(asUser(admin,"select admin_preview_bulk_access(array['bulk@example.test']);")));
   const key=randomUUID();
   const execute="select admin_execute_bulk_access(array['bulk@example.test'],'"+plan+"','2090-01-01','2090-01-08','Synthetic bulk',null,true,'"+key+"','"+preview.preview_hash+"');";
   const before=await count('notifications');
   const results=await Promise.all([sql(asUser(admin,execute+'select pg_sleep(0.4);')),sql(asUser(admin,execute))]);
   assert.deepEqual(JSON.parse(results[0]),JSON.parse(results[1]));
   assert.equal(await count('access_grant_batches'),1);assert.equal(await count('notifications'),before+1);
  });
 } finally {
  // Removes only this exact disposable, isolated synthetic-data container.
  if(container&&/^[a-f0-9]{64}$/.test(container))await docker(['stop','--time','1',container]);
 }
});
