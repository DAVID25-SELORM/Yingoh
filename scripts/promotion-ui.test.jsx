// @vitest-environment jsdom
import React from 'react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
const mock=vi.hoisted(()=>({rpc:vi.fn(),invoke:vi.fn(),controls:{},rows:[]}));
vi.mock('../src/services/accessPromotions',async original=>({...await original(),accessRpc:(...args)=>mock.rpc(...args)}));
vi.mock('../src/services/supabase',()=>({recordLegalAcceptance:async()=>({error:null}),supabase:{
 functions:{invoke:(...args)=>mock.invoke(...args)},
 from:table=>{const q=new Proxy({}, {get:(_,key)=>key==='then'?resolve=>Promise.resolve({data:table==='payment_plans'?[{id:'plan',name:'30-Day Pass'}]:mock.controls}).then(resolve):()=>q});return q;},
}}));
import PromotionCheckout from '../src/components/PromotionCheckout';
import PromotionManager from '../src/components/PromotionManager';
const session={user:{id:'student'}},access={can:()=>true};
beforeEach(()=>{
 mock.controls={promo_codes_enabled:true,complimentary_access_enabled:true,hubtel_payments_enabled:false};
 mock.rows=[];mock.invoke.mockReset().mockResolvedValue({data:{state:'processing',orderId:'order'}});
 mock.rpc.mockReset().mockImplementation(async name=>{
  if(name==='my_access_payment_orders')return mock.rows;
  if(name==='my_promotion_confirmations')return [];
  if(name==='preview_access_plan')return {original_minor:21546,duration_days:30};
  if(name==='preview_access_promotion')return {code:'FREE30',final_minor:0,original_minor:21546,discount_minor:0,benefit_type:'free_access_days',benefit_units:30};
  if(name==='redeem_access_promotion')return {label:'Promo Access'};
  if(name==='admin_list_promotions')return {rows:[],total:0};
  if(name==='admin_save_promotion')return 'saved';
  return {rows:[],total:0};
 });
});
afterEach(cleanup);
it('free promo requires apply and confirmation, never invokes Hubtel',async()=>{
 render(<PromotionCheckout session={session}/>);
 fireEvent.change(screen.getByLabelText('Have a promo code?'),{target:{value:'FREE30'}});
 await waitFor(()=>expect(screen.getByRole('button',{name:'Apply promo'}).disabled).toBe(false));
 fireEvent.click(screen.getByRole('button',{name:'Apply promo'}));
 const confirm=await screen.findByRole('button',{name:'Confirm complimentary access'});
 fireEvent.click(screen.getByRole('checkbox'));
 expect(mock.rpc.mock.calls.some(([name])=>name==='redeem_access_promotion')).toBe(false);
 fireEvent.click(confirm);fireEvent.click(confirm);
 await screen.findByText('Promo Access confirmed. No payment was taken.');
 expect(mock.rpc.mock.calls.filter(([name])=>name==='redeem_access_promotion')).toHaveLength(1);
 expect(mock.invoke).not.toHaveBeenCalled();
});
it('server pause disables checkout and stale quote is cleared on plan/code edits',async()=>{
 render(<PromotionCheckout session={session}/>);
 await screen.findByText(/Hubtel payments are paused/);
 fireEvent.change(screen.getByLabelText('Mobile Money number (233…)'),{target:{value:'233200000000'}});
 expect(screen.getByRole('button',{name:'Request Hubtel payment'}).disabled).toBe(true);
 fireEvent.change(screen.getByLabelText('Have a promo code?'),{target:{value:'FREE30'}});
 await waitFor(()=>expect(screen.getByRole('button',{name:'Apply promo'}).disabled).toBe(false));
 fireEvent.click(screen.getByRole('button',{name:'Apply promo'}));await screen.findByText('30 days complimentary access applied');
 fireEvent.change(screen.getByLabelText('Have a promo code?'),{target:{value:'OTHER'}});
 expect(screen.queryByText('30 days complimentary access applied')).toBeNull();
});
it('payable checkout sends identifiers and mobile details, never client prices',async()=>{
 mock.controls.hubtel_payments_enabled=true;
 render(<PromotionCheckout session={session}/>);
 fireEvent.change(screen.getByLabelText('Mobile Money number (233…)'),{target:{value:'233200000000'}});
 fireEvent.click(screen.getByRole('checkbox'));
 await waitFor(()=>expect(screen.getByRole('button',{name:'Request Hubtel payment'}).disabled).toBe(false));
 fireEvent.click(screen.getByRole('button',{name:'Request Hubtel payment'}));
 await waitFor(()=>expect(mock.invoke).toHaveBeenCalledTimes(1));
 const body=mock.invoke.mock.calls[0][1].body;
 expect(Object.keys(body).sort()).toEqual(['channel','idempotencyKey','phone','planId','promoCode']);
 expect(body.planId).toBe('plan');expect(body.idempotencyKey).toMatch(/^[a-f0-9-]{36}$/);
});
it('pending history prevents another charge and verification cannot assert financial status',async()=>{
 mock.controls.hubtel_payments_enabled=true;
 mock.rows=[{id:'order',plan_name:'30-Day Pass',state:'processing',amount_minor:21546,original_minor:21546,discount_minor:0}];
 render(<PromotionCheckout session={session}/>);
 const verify=await screen.findByRole('button',{name:'Verify payment status'});
 fireEvent.change(screen.getByLabelText('Mobile Money number (233…)'),{target:{value:'233200000000'}});
 expect(screen.getByRole('button',{name:'Request Hubtel payment'}).disabled).toBe(true);
 fireEvent.click(verify);
 await waitFor(()=>expect(mock.invoke).toHaveBeenCalledWith('hubtel-checkout',{body:{action:'verify',orderId:'order'}}));
});
it('promo wizard performs no writes until step-six confirmation',async()=>{
 render(<PromotionManager access={access} plans={[{id:'plan',name:'30-Day Pass'}]}/>);
 fireEvent.click(screen.getByRole('button',{name:'Create promo'}));
 fireEvent.change(screen.getByLabelText('Name'),{target:{value:'Welcome'}});
 fireEvent.change(screen.getByLabelText('Code'),{target:{value:'WELCOME'}});
 for(let i=0;i<5;i++)fireEvent.click(screen.getByRole('button',{name:'Continue'}));
 const confirm=screen.getByRole('button',{name:'Confirm promotion'});
 expect(mock.rpc.mock.calls.some(([name])=>name==='admin_save_promotion')).toBe(false);
 fireEvent.click(confirm);fireEvent.click(confirm);
 await waitFor(()=>expect(mock.rpc.mock.calls.filter(([name])=>name==='admin_save_promotion')).toHaveLength(1));
});
it('read-only preview disables promo mutation entry points',async()=>{
 render(<PromotionManager access={access} plans={[]} readOnly/>);
 expect(screen.getByRole('button',{name:'Create promo'}).disabled).toBe(true);
});
it('new promotions get an auto-generated code that can be regenerated, and the generator is unambiguous and unique',async()=>{
 const {generatePromoCode}=await import('../src/services/accessPromotions');
 const codes=new Set(Array.from({length:500},()=>generatePromoCode()));
 expect(codes.size).toBe(500);
 for(const c of codes)expect(c).toMatch(/^NF-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
 render(<PromotionManager access={access} plans={[{id:'plan',name:'30-Day Pass'}]}/>);
 fireEvent.click(screen.getByRole('button',{name:'Create promo'}));
 const input=screen.getByLabelText('Code');const first=input.value;
 expect(first).toMatch(/^NF-[A-Z2-9]{6}$/);
 fireEvent.click(screen.getByRole('button',{name:'Generate new code'}));
 expect(screen.getByLabelText('Code').value).toMatch(/^NF-[A-Z2-9]{6}$/);expect(screen.getByLabelText('Code').value).not.toBe(first);
 fireEvent.change(screen.getByLabelText('Name'),{target:{value:'Auto'}});
 for(let i=0;i<5;i++)fireEvent.click(screen.getByRole('button',{name:'Continue'}));
 fireEvent.click(screen.getByRole('button',{name:'Confirm promotion'}));
 await waitFor(()=>{const call=mock.rpc.mock.calls.find(([n])=>n==='admin_save_promotion');expect(call[1].p_config.code).toMatch(/^NF-[A-Z2-9]{6}$/);});
});
