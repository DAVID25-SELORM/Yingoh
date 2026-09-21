import React,{useEffect,useRef,useState} from 'react';
import {accessRpc,localDateTime} from '../services/accessPromotions';
const time=value=>value?new Date(value).toLocaleString():'—';
const money=value=>'GHS '+(Number(value)/100).toFixed(2);
export function promotionBenefit(p) {
 return p.benefit_type==='free_access_days'?p.benefit_units+' days complimentary access':
  p.benefit_type==='percentage_discount'?(p.benefit_units/100)+'% discount':money(p.benefit_units)+' discount';
}
function PromotionWizard({record,duplicate,plans,onClose,onSaved}) {
 const [step,setStep]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const running=useRef(false);
 const [values,setValues]=useState({
  code:duplicate?'':record?.code??'',name:duplicate?(record.name+' copy'):record?.name??'',description:record?.description??'',
  benefit_type:record?.benefit_type??'percentage_discount',benefit_units:record?.benefit_units??2000,
  starts_at:localDateTime(record?new Date(record.valid_from):new Date()),
  expires_at:localDateTime(record?new Date(record.expires_at):new Date(Date.now()+30*86400000)),
  plan_id:record?.restricted_plan_id??'',new_users_only:record?.eligibility==='new_users',
  minimum_ghs_minor:record?.minimum_ghs_minor??0,max_uses:record?.max_uses??'',per_user_limit:record?.max_per_user??1,
 });
 const set=(key,value)=>setValues(v=>({...v,[key]:value}));
 const steps=['Details','Benefit','Eligibility','Date window','Usage limits','Review'];
 async function submit(e) {
  e.preventDefault();setError('');
  if(step<5){setStep(v=>v+1);return;}
  if(running.current)return;running.current=true;setBusy(true);
  try {
   await accessRpc('admin_save_promotion',{p_id:duplicate?null:record?.id??null,p_revision:duplicate?null:record?.revision??null,
    p_config:{...values,code:values.code.trim().toUpperCase(),benefit_units:Number(values.benefit_units),
     minimum_ghs_minor:Number(values.minimum_ghs_minor),max_uses:values.max_uses===''?null:Number(values.max_uses),
     per_user_limit:Number(values.per_user_limit),plan_id:values.plan_id||null,
     starts_at:new Date(values.starts_at).toISOString(),expires_at:new Date(values.expires_at).toISOString()}});
   onSaved();
  }catch(err){setError(err.message);}finally{running.current=false;setBusy(false);}
 }
 return <section className="ap-panel" aria-label="Promotion wizard"><header className="ap-header"><h3>{duplicate?'Duplicate':record?'Edit':'Create'} promotion</h3><button className="ghost-btn" disabled={busy} onClick={onClose}>Cancel</button></header>
  <p aria-live="polite">Step {step+1} of 6 · {steps[step]}</p>{error&&<p role="alert">{error}</p>}
  <form onSubmit={submit}><fieldset disabled={busy}>
   {step===0&&<><label>Name<input required maxLength={150} value={values.name} onChange={e=>set('name',e.target.value)}/></label><label>Code<input required pattern="[A-Za-z0-9][A-Za-z0-9_-]{2,63}" value={values.code} onChange={e=>set('code',e.target.value)}/></label><label>Description<textarea maxLength={2000} value={values.description} onChange={e=>set('description',e.target.value)}/></label></>}
   {step===1&&<><label>Benefit type<select value={values.benefit_type} onChange={e=>{set('benefit_type',e.target.value);set('benefit_units',e.target.value==='percentage_discount'?2000:30);}}><option value="percentage_discount">Percentage discount</option><option value="fixed_discount">Fixed GHS discount</option><option value="free_access_days">Complimentary access days</option></select></label>
    <label>{values.benefit_type==='percentage_discount'?'Percentage':values.benefit_type==='fixed_discount'?'Discount in GHS':'Days'}<input type="number" required min={values.benefit_type==='free_access_days'?1:0.01} step={values.benefit_type==='free_access_days'?1:0.01} max={values.benefit_type==='percentage_discount'?100:values.benefit_type==='free_access_days'?3650:21474836} value={values.benefit_type==='free_access_days'?values.benefit_units:values.benefit_units/100} onChange={e=>set('benefit_units',Math.round(Number(e.target.value)*(values.benefit_type==='free_access_days'?1:100)))}/></label><p>{promotionBenefit(values)}</p></>}
   {step===2&&<><label>Valid plan<select value={values.plan_id} onChange={e=>set('plan_id',e.target.value)}><option value="">All supported subscription plans</option>{plans.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Minimum purchase (GHS)<input type="number" min="0" step="0.01" required value={values.minimum_ghs_minor/100} onChange={e=>set('minimum_ghs_minor',Math.round(Number(e.target.value)*100))}/></label><label className="ap-checkbox"><input type="checkbox" checked={values.new_users_only} onChange={e=>set('new_users_only',e.target.checked)}/>New subscribers only</label></>}
   {step===3&&<><label>Starts<input type="datetime-local" required value={values.starts_at} onChange={e=>set('starts_at',e.target.value)}/></label><label>Expires<input type="datetime-local" required min={values.starts_at} value={values.expires_at} onChange={e=>set('expires_at',e.target.value)}/></label><p>Dates use your local timezone. Server validation is authoritative.</p></>}
   {step===4&&<><label>Maximum total uses (blank means unlimited)<input type="number" min="1" step="1" value={values.max_uses} onChange={e=>set('max_uses',e.target.value)}/></label><label>Per-student limit<input type="number" required min="1" step="1" value={values.per_user_limit} onChange={e=>set('per_user_limit',e.target.value)}/></label></>}
   {step===5&&<><h4>{values.name} · {values.code.toUpperCase()}</h4><p>{values.description}</p><p>{promotionBenefit(values)}</p><p>{plans.find(p=>p.id===values.plan_id)?.name??'All supported plans'} · {values.new_users_only?'New subscribers only':'All students'}</p><p>Minimum: {money(values.minimum_ghs_minor)} · Total uses: {values.max_uses||'Unlimited'} · Per student: {values.per_user_limit}</p><p>{time(values.starts_at)} → {time(values.expires_at)}</p><p>New promotions are created paused. Used promotions cannot be edited; duplicate them instead.</p></>}
   <div className="ap-actions">{step>0&&<button type="button" className="ghost-btn" onClick={()=>setStep(v=>v-1)}>Back</button>}<button className="primary-btn">{busy?'Saving…':step===5?'Confirm promotion':'Continue'}</button></div>
  </fieldset></form>
 </section>;
}
export default function PromotionManager({access,plans,readOnly=false}) {
 const [data,setData]=useState({rows:[],total:0}),[page,setPage]=useState(0),[revision,setRevision]=useState(0);
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[form,setForm]=useState(null),[confirm,setConfirm]=useState(null);
 const [selected,setSelected]=useState(null),[redemptions,setRedemptions]=useState({rows:[],total:0}),[redemptionPage,setRedemptionPage]=useState(0);
 const running=useRef(false);const allowed=access.can('promo.view'),canReadRedemptions=access.can('promo.view_redemptions');
 useEffect(()=>{
  if(!allowed)return;let current=true;setBusy(true);
  accessRpc('admin_list_promotions',{p_page:page}).then(result=>{if(current){setData(result);setError('');}})
   .catch(e=>{if(current)setError(e.message);}).finally(()=>{if(current)setBusy(false);});
  return()=>{current=false;};
 },[allowed,page,revision]);
 useEffect(()=>{
  if(!selected||!canReadRedemptions)return;let current=true;
  accessRpc('admin_promotion_redemptions',{p_promo:selected.id,p_page:redemptionPage}).then(result=>{if(current)setRedemptions(result);})
   .catch(e=>{if(current)setError(e.message);});return()=>{current=false;};
 },[selected,redemptionPage,revision,canReadRedemptions]);
 const saved=()=>{setForm(null);setRevision(v=>v+1);};
 async function changeStatus() {
  if(running.current)return;running.current=true;setBusy(true);
  try{await accessRpc('admin_set_promotion_status',{p_id:confirm.row.id,p_action:confirm.action,p_revision:confirm.row.revision});setConfirm(null);setRevision(v=>v+1);}
  catch(e){setError(e.message);}finally{running.current=false;setBusy(false);}
 }
 if(!allowed)return <p role="alert">Promotion view permission is required.</p>;
 return <section aria-label="Promo codes">
  <header className="ap-header"><h3>Promo Codes</h3><button className="primary-btn" disabled={readOnly||!access.can('promo.create')} onClick={()=>setForm({})}>Create promo</button></header>
  {error&&<p role="alert">{error}</p>}
  <div className="ap-stats">{[['Active',data.active],['Scheduled',data.scheduled],['Expired',data.expired],['Redemptions',data.redemptions],['Discount value',money(data.discount_minor??0)],['Complimentary grants',data.complimentary]].map(([label,value])=><article key={label}><h4>{label}</h4><strong>{value??'—'}</strong></article>)}</div>
  {form&&!readOnly&&<PromotionWizard {...form} plans={plans} onClose={()=>setForm(null)} onSaved={saved}/>}
  {confirm&&!readOnly&&<section className="ap-panel"><h4>Confirm {confirm.action}: {confirm.row.code}</h4><p>This changes the code’s availability. Global server controls still apply.</p><div className="ap-actions"><button className="ghost-btn" disabled={busy} onClick={()=>setConfirm(null)}>Cancel</button><button className="primary-btn" disabled={busy} onClick={changeStatus}>Confirm status change</button></div></section>}
  <p aria-live="polite">{busy?'Loading…':data.total+' promotions · Page '+(page+1)}</p>
  <ul className="ap-rows">{data.rows.map(row=><li key={row.id}><div><strong>{row.code} · {row.name}</strong><p>{promotionBenefit(row)} · <span className="ap-badge">{row.effective_status}</span></p><p>{plans.find(p=>p.id===row.restricted_plan_id)?.name??'All supported plans'} · {row.completed}/{row.max_uses??'Unlimited'} uses</p><p>{time(row.valid_from)} → {time(row.expires_at)}</p><details><summary>View promotion</summary><p>{row.description||'No description'}</p><p>Per student: {row.max_per_user}. Minimum purchase: {money(row.minimum_ghs_minor)}. {row.eligibility==='new_users'?'New subscribers only.':''}</p></details></div>
   <div className="ap-actions"><button className="ghost-btn" disabled={readOnly||row.completed>0||!access.can('promo.edit')} onClick={()=>setForm({record:row})}>Edit</button><button className="ghost-btn" disabled={readOnly||!access.can('promo.create')} onClick={()=>setForm({record:row,duplicate:true})}>Duplicate</button><button className="ghost-btn" disabled={readOnly||row.effective_status==='expired'||!access.can('promo.pause')} onClick={()=>setConfirm({row,action:row.is_active?'pause':'resume'})}>{row.is_active?'Pause':'Resume'}</button><button className="ghost-btn" disabled={readOnly||row.effective_status==='expired'||!access.can('promo.pause')} onClick={()=>setConfirm({row,action:'end'})}>End early</button><button className="ghost-btn" disabled={!access.can('promo.view_redemptions')} onClick={()=>{setSelected(row);setRedemptionPage(0);}}>View redemptions</button></div>
  </li>)}</ul><div className="ap-actions"><button className="ghost-btn" disabled={busy||page===0} onClick={()=>setPage(p=>p-1)}>Previous promos</button><button className="ghost-btn" disabled={busy||(page+1)*25>=data.total} onClick={()=>setPage(p=>p+1)}>Next promos</button></div>
  {selected&&<section className="ap-panel"><header className="ap-header"><h4>{selected.code} redemptions</h4><button className="ghost-btn" onClick={()=>setSelected(null)}>Close redemptions</button></header><p>{redemptions.total} records</p><ul className="ap-rows">{redemptions.rows.map(r=><li key={r.id}><div><strong>{r.full_name||r.email}</strong><p>{r.plan_name} · {r.outcome} · {time(r.redeemed_at)}</p><p>Original {money(r.original_ghs_minor)} · Discount {money(r.discount_ghs_minor)} · {r.final_ghs_minor===0?'Complimentary confirmation':money(r.final_ghs_minor)}</p></div></li>)}</ul><div className="ap-actions"><button className="ghost-btn" disabled={redemptionPage===0} onClick={()=>setRedemptionPage(p=>p-1)}>Previous redemptions</button><button className="ghost-btn" disabled={(redemptionPage+1)*25>=redemptions.total} onClick={()=>setRedemptionPage(p=>p+1)}>Next redemptions</button></div></section>}
 </section>;
}
