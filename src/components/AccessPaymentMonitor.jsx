import React,{useEffect,useState} from 'react';
import {accessRpc} from '../services/accessPromotions';
export default function AccessPaymentMonitor(){
 const [page,setPage]=useState(0),[data,setData]=useState({rows:[],total:0}),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 useEffect(()=>{
  let current=true;accessRpc('admin_access_payments',{p_page:page}).then(result=>{if(current){setData(result);setError('');}})
   .catch(e=>{if(current)setError(e.message);});return()=>{current=false;};
 },[page,revision]);
 return <section className="ap-panel" aria-label="Payment monitoring"><header className="ap-header"><h3>Hubtel payment monitoring</h3><button className="ghost-btn" onClick={()=>setRevision(v=>v+1)}>Refresh payments</button></header>
  <p>Read-only monitoring. Processing payments must be independently verified; do not recreate an ambiguous charge.</p>
  {error&&<p role="alert">{error}</p>}<p>{data.total} orders · Page {page+1}</p>
  <ul className="ap-rows">{data.rows.map(row=><li key={row.id}><div><strong>{row.full_name||row.email} · {row.plan_name}</strong><p>{row.state} · {row.currency} {(row.amount_minor/100).toFixed(2)}</p>
   <p>Created {new Date(row.created_at).toLocaleString()}</p><details><summary>Reconciliation details</summary><p>Order: {row.id}</p><p>Provider reference: {row.provider_reference||'Not yet confirmed'}</p><p>Initialization attempted: {row.create_attempted_at?new Date(row.create_attempted_at).toLocaleString():'No'}</p></details></div></li>)}</ul>
  <div className="ap-actions"><button className="ghost-btn" disabled={!page} onClick={()=>setPage(p=>p-1)}>Previous payments</button><button className="ghost-btn" disabled={(page+1)*25>=data.total} onClick={()=>setPage(p=>p+1)}>Next payments</button></div>
 </section>;
}
