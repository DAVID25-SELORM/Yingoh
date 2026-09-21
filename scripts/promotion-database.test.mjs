import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { install,admin,student,other,plan,promoConfig } from './fixtures/promotion-database.mjs';

test('transactional promotions: existing-schema extension and authorization',async t=>{
 const db=new PGlite();
 const login=async id=>{await db.exec('reset role');await db.query("select set_config('test.uid',$1,false)",[id]);await db.exec('set role authenticated');};
 const owner=()=>db.exec('reset role');
 const create=async config=>{
  await login(admin);
  const id=(await db.query('select admin_save_promotion(null,null,$1) as id',[config])).rows[0].id;
  await db.query("select admin_set_promotion_status($1,'resume',1)",[id]);return id;
 };
 const quote=code=>db.query('select preview_access_promotion($1,$2) as value',[plan,code]);
 const redeem=(code,key=randomUUID())=>db.query('select redeem_access_promotion($1,$2,$3) as value',[plan,code,key]);
 try {
  await install(sql=>db.exec(sql));
  let free;
  await t.test('creation is paused by default, normalized, private and permission guarded',async()=>{
   await login(student);await assert.rejects(db.query('select admin_save_promotion(null,null,$1)',[promoConfig()]),/Not authorized/);
   free=await create(promoConfig({code:' welcome30 '}));
   await login(student);await assert.rejects(quote('WELCOME30'),/Promotions are paused/);
   await assert.rejects(redeem('WELCOME30'),/Complimentary access is disabled/);
   assert.equal((await db.query('select * from promo_codes')).rows.length,0);
   await assert.rejects(db.query('select quote_access_promotion($1,$2,$3)',[other,plan,'WELCOME30']),/permission denied/);
   await owner();await db.exec('update access_system_controls set complimentary_access_enabled=true,promo_codes_enabled=true');
  });
  await t.test('legacy endpoint cannot apply managed codes or mutate their metrics',async()=>{
   await login(student);
   const data=(await db.query("select validate_promo_code('welcome30','thirty_day',0) as value")).rows[0].value;
   assert.equal(data.valid,false);
   await assert.rejects(db.query("select validate_legacy_promo_code('welcome30','thirty_day',0)"),/permission denied/);
  });
  await t.test('preview uses trusted catalog, has no writes, percentage/fixed/free math',async()=>{
   await create(promoConfig({code:'PERCENT',benefit_type:'percentage_discount',benefit_units:2000}));
   await login(student);
   const q=(await quote('percent')).rows[0].value;
   assert.equal(q.original_minor,21546);assert.equal(q.discount_minor,4309);assert.equal(q.final_minor,17237);
   await assert.rejects(redeem('PERCENT'),/Payment required/);
   await create(promoConfig({code:'FIXED',benefit_type:'fixed_discount',benefit_units:999999}));
   await login(student);assert.equal((await quote('FIXED')).rows[0].value.final_minor,0);
   await owner();assert.equal((await db.query('select count(*)::int n from promo_redemptions')).rows[0].n,0);
  });
  await t.test('free grant, redemption, audit and notification commit once; conflicting retry rejected',async()=>{
   await login(student);const key=randomUUID(),a=(await redeem('welcome30',key)).rows[0].value;
   assert.deepEqual((await redeem(' WELCOME30 ',key)).rows[0].value,a);
   await assert.rejects(redeem('FIXED',key),/Idempotency conflict/);
   await assert.rejects(redeem('WELCOME30'),/Promotion already used/);
   await owner();
   assert.equal((await db.query('select count(*)::int n from notifications')).rows[0].n,1);
   assert.equal((await db.query("select count(*)::int n from admin_audit_logs where action='PROMO_REDEEMED'")).rows[0].n,1);
   assert.equal((await db.query('select count(*)::int n from subscriptions')).rows[0].n,0);
   assert.equal((await db.query('select count(*)::int n from invoices')).rows[0].n,0);
   assert.equal((await db.query('select used_count from promo_codes where id=$1',[free])).rows[0].used_count,1);
  });
  await t.test('fully discounted access appends after existing expiry and is never a paid invoice',async()=>{
   await login(student);const result=(await redeem('FIXED')).rows[0].value;assert.equal(result.label,'Fully Discounted');
   await owner();const rows=(await db.query('select starts_at,expires_at from access_grants order by starts_at')).rows;
   assert.equal(rows.length,2);assert.equal(rows[1].starts_at.getTime(),rows[0].expires_at.getTime());
   assert.equal((await db.query("select count(*)::int n from promo_redemptions where status='paid'")).rows[0].n,0);
  });
  await t.test('managed rows cannot be overwritten or deleted via old finance writes',async()=>{
   await login(other);
   assert.equal((await db.query('delete from promo_codes where id=$1 returning id',[free])).rows.length,0);
   await assert.rejects(db.query('insert into promo_redemptions(promo_id,user_id) values($1,$2)',[free,other]),/row-level security/);
   assert.equal((await db.query('select * from promo_redemptions')).rows.length,0);
   await login(admin);
   assert.equal((await db.query('delete from promo_codes where id=$1 returning id',[free])).rows.length,0);
   await assert.rejects(db.query('select admin_save_promotion($1,2,$2)',[free,promoConfig()]),/immutable/);
  });
  await t.test('date, pause, new user, minimum purchase and total-limit validation',async()=>{
   for(const [code,changes,expected] of [
    ['FUTURE',{starts_at:'2098-01-01T00:00:00Z'},/not started/],
    ['MINIMUM',{minimum_ghs_minor:30000},/Minimum purchase/],
    ['NEWUSER',{new_users_only:true},/new subscribers/],
   ]) {
    await create(promoConfig({code,...changes}));await login(student);await assert.rejects(quote(code),expected);
   }
   const limit=await create(promoConfig({code:'LASTONE',max_uses:1}));
   await login(student);await redeem('LASTONE');await login(other);await assert.rejects(redeem('LASTONE'),/limit reached/);
   await login(admin);await db.query("select admin_set_promotion_status($1,'pause',2)",[limit]);
   await login(student);await assert.rejects(quote('LASTONE'),/inactive/);
   await login(admin);await db.query("select admin_set_promotion_status($1,'end',3)",[limit]);
   await assert.rejects(db.query("select admin_set_promotion_status($1,'resume',4)",[limit]),/expired/);
  });
  await t.test('grant/audit/notice failures roll back redemption and capacity consumption',async()=>{
   const id=await create(promoConfig({code:'ROLLBACK'}));await owner();
   await db.exec("create function fail_notice() returns trigger language plpgsql as $$ begin raise exception 'Synthetic notification failure'; end $$; create trigger fail_notice before insert on notifications for each row execute function fail_notice();");
   await login(student);await assert.rejects(redeem('ROLLBACK'),/Synthetic notification failure/);
   await owner();assert.equal((await db.query('select used_count from promo_codes where id=$1',[id])).rows[0].used_count,0);
   assert.equal((await db.query('select count(*)::int n from promo_redemptions where promo_id=$1',[id])).rows[0].n,0);
   await db.exec('drop trigger fail_notice on notifications');
  });
  await t.test('staff reporting paginates and excludes requests; students cannot inspect others',async()=>{
   await login(student);await assert.rejects(db.query('select admin_list_promotions()'),/Not authorized/);
   await login(admin);const list=(await db.query('select admin_list_promotions() as value')).rows[0].value;
   assert.ok(list.redemptions>=3);assert.ok(list.discount_minor>0);
   const rows=(await db.query('select admin_promotion_redemptions($1) as value',[free])).rows[0].value.rows;
   assert.equal(rows.length,1);assert.equal('request_payload' in rows[0],false);
   await assert.rejects(db.query('select admin_list_promotions(-1)'),/Invalid page/);
  });
 }finally{await db.close();}
});
