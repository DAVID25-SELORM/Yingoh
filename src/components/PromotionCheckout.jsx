import React,{useEffect,useRef,useState} from 'react';
import {supabase,recordLegalAcceptance} from '../services/supabase';
import {accessRpc} from '../services/accessPromotions';
import './access-promotions.css';
const money=n=>'GHS '+(Number(n)/100).toFixed(2);
export default function PromotionCheckout({session}) {
 const [plans,setPlans]=useState([]),[plan,setPlan]=useState(''),[code,setCode]=useState(''),[quote,setQuote]=useState(null);
 const [controls,setControls]=useState(null),[phone,setPhone]=useState(''),[channel,setChannel]=useState('mtn-gh');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [orders,setOrders]=useState([]),[confirmations,setConfirmations]=useState([]),[revision,setRevision]=useState(0);
 const [planPrice,setPlanPrice]=useState(null);
 const [accepted,setAccepted]=useState(false);
 const running=useRef(false),request=useRef(null);
 useEffect(()=>{
  if(!session?.user?.id||!supabase)return;let current=true;
  Promise.all([supabase.from('payment_plans').select('id,name').eq('is_active',true).gt('price_usd',0).order('sort_order'),
   supabase.from('access_system_controls').select('*').single(),accessRpc('my_access_payment_orders'),accessRpc('my_promotion_confirmations')])
   .then(([p,c,o,r])=>{if(!current)return;if(p.error||c.error)throw new Error('Checkout setup is unavailable.');
    setPlans(p.data??[]);setPlan(v=>v||p.data?.[0]?.id||'');setControls(c.data);setOrders(o);setConfirmations(r);})
   .catch(e=>{if(current)setError(e.message);});return()=>{current=false;};
 },[session?.user?.id,revision]);
 useEffect(()=>{
  if(!plan)return;let current=true;setPlanPrice(null);
  accessRpc('preview_access_plan',{p_plan:plan}).then(value=>{if(current)setPlanPrice(value);})
   .catch(e=>{if(current)setError(e.message);});return()=>{current=false;};
 },[plan]);
 const invalidate=()=>{setQuote(null);request.current=null;setMessage('');};
 async function apply() {
  if(running.current)return;running.current=true;setBusy(true);setError('');
  try{setQuote(await accessRpc('preview_access_promotion',{p_plan:plan,p_code:code}));request.current=null;}
  catch(e){setQuote(null);setError(e.message);}finally{running.current=false;setBusy(false);}
 }
 async function complete() {
  if(running.current)return;running.current=true;setBusy(true);setError('');
  const zero=quote?.final_minor===0;
  request.current??=crypto.randomUUID();
  try{
   if(!accepted)throw new Error('Accept the Terms and acknowledge the Refund Policy before continuing.');
   const {error:acceptanceError}=await recordLegalAcceptance('checkout');
   if(acceptanceError)throw new Error('Policy acceptance could not be recorded. Please try again.');
   if(zero){
    const result=await accessRpc('redeem_access_promotion',{p_plan:plan,p_code:quote.code,p_request:request.current});
    setMessage(result.label+' confirmed. No payment was taken.');setQuote(null);request.current=null;
    globalThis.dispatchEvent(new Event('focus'));
   }else{
    const {data,error:failure}=await supabase.functions.invoke('hubtel-checkout',{body:{planId:plan,promoCode:quote?.code??null,
     idempotencyKey:request.current,phone,channel}});
    if(failure)throw new Error('Checkout could not be confirmed. Check payment history before trying again.');
    setMessage(data.state==='successful'?'Payment verified. Receipt is available below.':
     data.message||'Check your phone to approve the payment, then verify its status below. Do not submit another payment.');
   }
   setRevision(v=>v+1);
  }catch(e){setError(e.message);}finally{running.current=false;setBusy(false);}
 }
 async function verify(id) {
  if(running.current)return;running.current=true;setBusy(true);setError('');
  try{
   const {data,error:failure}=await supabase.functions.invoke('hubtel-checkout',{body:{action:'verify',orderId:id}});
   if(failure)throw new Error('Payment verification is unavailable. Do not pay again.');
   setMessage(data.state==='successful'?'Payment verified.':data.message||'Payment status: '+data.state);
   setRevision(v=>v+1);globalThis.dispatchEvent(new Event('focus'));
  }catch(e){setError(e.message);}finally{running.current=false;setBusy(false);}
 }
 if(!session?.user?.id)return null;
 const pending=orders.some(o=>['pending','processing'].includes(o.state));
 return <section className="ap-page" aria-label="Promotions and Hubtel checkout"><div className="ap-panel">
  <h3>Promotions &amp; Mobile Money</h3><p>Existing subscription prices apply. All amounts and eligibility are confirmed by the server.</p>
  {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
  <fieldset disabled={busy}><div className="ap-grid"><label>Subscription plan<select value={plan} onChange={e=>{setPlan(e.target.value);invalidate();}}>{plans.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
   <label>Have a promo code?<input maxLength={64} value={code} onChange={e=>{setCode(e.target.value);invalidate();}}/></label>
   <button className="ghost-btn" disabled={!plan||!code.trim()||!controls?.promo_codes_enabled} onClick={apply}>Apply promo</button></div>
   {!controls?.promo_codes_enabled&&<p>Promo redemption is currently paused.</p>}
   {!quote&&planPrice&&<p>Server price: <strong>{money(planPrice.original_minor)}</strong> · {planPrice.duration_days} days</p>}
   {quote&&<div className="ap-banner"><strong>{quote.benefit_type==='free_access_days'?quote.benefit_units+' days complimentary access applied':
    quote.benefit_type==='percentage_discount'?(quote.benefit_units/100)+'% discount applied':money(quote.benefit_units)+' discount applied'}</strong>
    <p>Original {money(quote.original_minor)} · Discount {money(quote.discount_minor)} · Total {money(quote.final_minor)}</p>
    {quote.final_minor===0&&<p>No payment will be taken. Access starts after any existing complimentary period.</p>}</div>}
   {quote?.final_minor!==0&&<div className="ap-grid"><label>Mobile Money number (233…)<input inputMode="tel" pattern="233[0-9]{9}" value={phone} onChange={e=>{setPhone(e.target.value);request.current=null;}}/></label><label>Network<select value={channel} onChange={e=>{setChannel(e.target.value);request.current=null;}}><option value="mtn-gh">MTN</option><option value="vodafone-gh">Telecel</option><option value="tigo-gh">AT</option></select></label></div>}
   <label className="ap-checkbox"><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)}/>I accept the Terms and acknowledge the Refund Policy.</label>
   <p><a href="/?legal=terms" target="_blank" rel="noreferrer">Terms &amp; Conditions</a> · <a href="/?legal=refund" target="_blank" rel="noreferrer">Refund Policy</a></p>
   <button className="primary-btn" disabled={!accepted||!plan||!planPrice||(code.trim()&&!quote)||(quote?.final_minor===0?
    !controls?.complimentary_access_enabled:!controls?.hubtel_payments_enabled||pending||!/^233[0-9]{9}$/.test(phone))}
    onClick={complete}>{busy?'Processing…':quote?.final_minor===0?'Confirm complimentary access':'Request Hubtel payment'}</button>
   {!controls?.hubtel_payments_enabled&&<p>Hubtel payments are paused. No live payment will be initialized.</p>}
  </fieldset></div>
  <div className="ap-panel"><h3>Hubtel payment history &amp; receipts</h3>{!orders.length&&<p>No Hubtel orders yet.</p>}
   <ul className="ap-rows">{orders.map(o=><li key={o.id}><div><strong>{o.plan_name}</strong><p>{o.state==='successful'?(o.discount_minor>0?'Discounted':'Paid'):o.state} · {money(o.amount_minor)}</p>
    <p>Original: {money(o.original_minor)} · Discount: {money(o.discount_minor)}{o.promo_code?' · Promo: '+o.promo_code:''}</p>
    {o.state==='successful'&&<details><summary>View receipt</summary><p>Amount paid: {money(o.amount_minor)} · Method: Hubtel</p><p>Reference: {o.provider_reference}</p></details>}</div>
    {['pending','processing'].includes(o.state)&&<button className="ghost-btn" disabled={busy} onClick={()=>verify(o.id)}>Verify payment status</button>}</li>)}</ul>
   <h3>Access confirmations</h3>{!confirmations.length&&<p>No promotion confirmations yet.</p>}<ul className="ap-rows">{confirmations.map(c=><li key={c.id}><div><strong>{c.label} · {c.plan_name}</strong><p>{c.code} · No payment taken</p><p>{new Date(c.starts_at).toLocaleString()} → {new Date(c.expires_at).toLocaleString()}</p></div></li>)}</ul>
  </div>
 </section>;
}
