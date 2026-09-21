import {PGlite} from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import {install,admin,student,other,plan,promoConfig} from './fixtures/promotion-database.mjs';
test('payment order lifecycle, reservation and receipt invariants',async t=>{
 const db=new PGlite();
 const login=async id=>{await db.exec('reset role');await db.query("select set_config('test.uid',$1,false)",[id]);await db.exec('set role authenticated');};
 const service=async()=>{await db.exec('reset role;set role service_role');};
 const order=(key=randomUUID(),code=null)=>db.query('select create_access_payment_order($1,$2,$3,$4,$5) id',[plan,code,key,'233200000000','mtn-gh']);
 const settle=(id,state='successful',amount=17237)=>db.query('select settle_access_payment($1,$2,$3,$4,$5) state',[id,'reference-'+id,state,amount,'GHS']);
 let id,key;
 try{
  await install(sql=>db.exec(sql));
  await t.test('paused checkout and client direct settlement are denied',async()=>{
   await login(student);await assert.rejects(order(),/Payments are paused/);
   await assert.rejects(settle(randomUUID()),/permission denied/);
   await assert.rejects(db.query('insert into access_payment_orders(id) values($1)',[randomUUID()]),/permission denied/);
  });
  await t.test('same request reserves once; prices are derived server-side',async()=>{
   await db.exec('reset role; update access_system_controls set hubtel_payments_enabled=true,promo_codes_enabled=true');
   await login(admin);
   const promo=(await db.query('select admin_save_promotion(null,null,$1) id',[promoConfig({code:'PAY20',benefit_type:'percentage_discount',benefit_units:2000,max_uses:1})])).rows[0].id;
   await db.query("select admin_set_promotion_status($1,'resume',1)",[promo]);
   await login(student);key=randomUUID();id=(await order(key,'PAY20')).rows[0].id;
   assert.equal((await order(key,'pay20')).rows[0].id,id);
   await assert.rejects(order(key),/Idempotency conflict/);
   await assert.rejects(order(),/existing payment/);
   const rows=(await db.query('select my_access_payment_orders() rows')).rows[0].rows;
   assert.equal(rows[0].amount_minor,17237);assert.equal('phone' in rows[0],false);
   await login(other);assert.equal((await db.query('select my_access_payment_orders() rows')).rows[0].rows.length,0);
   await assert.rejects(order(randomUUID(),'PAY20'),/limit reached/);
  });
  await t.test('one initialization claim; abandoned/ambiguous processing cannot be reinitialized',async()=>{
   await service();assert.ok((await db.query('select claim_access_payment($1) value',[id])).rows[0].value);
   assert.equal((await db.query('select claim_access_payment($1) value',[id])).rows[0].value,null);
   await db.exec('reset role');await db.query("update access_payment_orders set created_at=now()-interval '2 days' where id=$1",[id]);
   await service();assert.equal((await db.query('select expire_unstarted_access_payments() n')).rows[0].n,0);
   const claim=(await db.query('select claim_access_payment_verification($1) value',[id])).rows[0].value;
   assert.equal(claim.amount_minor,17237);
   assert.equal((await db.query('select claim_access_payment_verification($1) value',[id])).rows[0].value,null);
  });
  await t.test('verified success commits one subscription, promo, receipt, notice and audit',async()=>{
   await service();await assert.rejects(settle(id,'successful',1),/verification mismatch/);
   assert.equal((await settle(id)).rows[0].state,'successful');
   assert.equal((await settle(id)).rows[0].state,'successful');
   await db.exec('reset role');
   for(const table of ['subscriptions','access_payment_confirmations','notifications'])
    assert.equal((await db.query('select count(*)::int n from '+table)).rows[0].n,1);
   assert.equal((await db.query("select count(*)::int n from admin_audit_logs where action='PAYMENT_CONFIRMED'")).rows[0].n,1);
   assert.equal((await db.query('select outcome from promo_redemptions')).rows[0].outcome,'completed');
   await login(student);assert.equal((await db.query('select * from access_payment_confirmations')).rows.length,1);
   await login(other);assert.equal((await db.query('select * from access_payment_confirmations')).rows.length,0);
  });
  await t.test('failure is idempotent, never activates access, and unknown order rejected',async()=>{
   await login(other);const failed=(await order()).rows[0].id;
   await service();await db.query('select claim_access_payment($1)',[failed]);
   assert.equal((await settle(failed,'failed',21546)).rows[0].state,'failed');
   assert.equal((await settle(failed,'failed',21546)).rows[0].state,'failed');
   await assert.rejects(settle(failed,'successful',21546),/reconciliation/);
   await assert.rejects(settle(randomUUID()),/Order not found/);
   await db.exec('reset role');assert.equal((await db.query('select count(*)::int n from subscriptions')).rows[0].n,1);
  });
  await t.test('unstarted abandoned order expires without a provider call',async()=>{
   await login(other);const abandoned=(await order()).rows[0].id;
   await db.exec('reset role');await db.query("update access_payment_orders set created_at=now()-interval '1 hour' where id=$1",[abandoned]);
   await service();assert.equal((await db.query('select expire_unstarted_access_payments() n')).rows[0].n,1);
   assert.equal((await db.query('select expire_unstarted_access_payments() n')).rows[0].n,0);
   assert.equal((await db.query('select claim_access_payment($1) value',[abandoned])).rows[0].value,null);
  });
  await t.test('combined activity and payment reports are permission guarded and sanitize payloads',async()=>{
   await login(student);await assert.rejects(db.query('select admin_access_activity()'),/Not authorized/);
   await assert.rejects(db.query('select admin_access_payments()'),/Not authorized/);
   await login(admin);
   const activity=(await db.query("select admin_access_activity(p_action=>'PAYMENT_CONFIRMED') value")).rows[0].value;
   assert.equal(activity.total,1);assert.equal('phone' in activity.rows[0].details,false);
   const report=(await db.query('select admin_access_payments() value')).rows[0].value;
   assert.equal(report.total,3);assert.equal('request_payload' in report.rows[0],false);
   const stats=(await db.query('select admin_access_dashboard() value')).rows[0].value;
   assert.equal(stats.monthly_redemptions,1);assert.equal(stats.discount_minor,4309);
  });
 }finally{await db.close();}
});
