import { createClient } from '@supabase/supabase-js';
import { HubtelProvider,readHubtelConfiguration } from '../_shared/hubtel-provider.ts';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async request=>{
 const origin=Deno.env.get('APP_URL');
 const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':origin??'null',
  'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin'};
 const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(request.method!=='POST')return reply({error:'method_not_allowed'},405);
 if(!origin || (request.headers.get('origin') && request.headers.get('origin')!==origin))return reply({error:'origin_not_allowed'},403);
 try{
  const authorization=request.headers.get('authorization');
  if(!authorization)return reply({error:'authentication_required'},401);
  const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!;
  const user=createClient(url,anon,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
  const {data:identity,error:authError}=await user.auth.getUser();
  if(authError||!identity.user)return reply({error:'authentication_required'},401);
  const raw=await request.text();if(raw.length>4096)return reply({error:'invalid_request'},400);
  const body=(()=>{try{return JSON.parse(raw);}catch{return undefined;}})(); // malformed JSON falls through to the 400 below
  if(!body||typeof body!=='object'||Array.isArray(body))return reply({error:'invalid_request'},400);
  const provider=new HubtelProvider(readHubtelConfiguration(key=>Deno.env.get(key)));
  const service=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
  let orderId:string;
  if(body.action==='verify'){
   if(Object.keys(body).some(k=>!['action','orderId'].includes(k))||!uuid.test(body.orderId))return reply({error:'invalid_request'},400);
   orderId=body.orderId;
  }else{
   if(Object.keys(body).some(k=>!['planId','promoCode','idempotencyKey','phone','channel'].includes(k)) ||
    !uuid.test(body.planId)||!uuid.test(body.idempotencyKey)||typeof body.phone!=='string'||
    (body.promoCode!=null&&typeof body.promoCode!=='string'))return reply({error:'invalid_request'},400);
   const {data,error}=await user.rpc('create_access_payment_order',{p_plan:body.planId,p_code:body.promoCode??null,
    p_request:body.idempotencyKey,p_phone:body.phone,p_channel:body.channel});
   if(error)return reply({error:'checkout_rejected'},409);
   orderId=data;
  }
  // Read only safe own projection; never let a caller initialize/verify another account.
  const {data:orders,error:listError}=await user.rpc('my_access_payment_orders');
  if(listError||!orders?.some((o:{id:string})=>o.id===orderId))return reply({error:'order_not_found'},404);
  if(body.action!=='verify'){
   const {data:claimed,error}=await service.rpc('claim_access_payment',{p_order:orderId});
   if(error)return reply({error:'checkout_unavailable'},409);
   if(claimed){
    try{
     const result=await provider.createPayment(claimed);
     const {error:saveError}=await service.rpc('record_access_payment_reference',{p_order:orderId,p_reference:result.reference});
     if(saveError)return reply({orderId,state:'processing',message:'Payment requires verification. Do not pay again.'},202);
    }catch{
     return reply({orderId,state:'processing',message:'Payment outcome is not yet confirmed. Check status; do not pay again.'},202);
    }
   }
  }
  const {data:verification,error:claimError}=await service.rpc('claim_access_payment_verification',{p_order:orderId});
  if(claimError)return reply({orderId,state:'processing'},202);
  if(verification){
   try{
    const result=await provider.verifyPayment(verification);
    const {error}=await service.rpc('settle_access_payment',{p_order:orderId,p_reference:result.reference,p_state:result.state,
     p_amount_minor:result.amountMinor,p_currency:result.currency});
    if(error)return reply({orderId,state:'processing',message:'Payment is awaiting reconciliation.'},202);
   }catch{return reply({orderId,state:'processing',message:'Payment is awaiting independent verification.'},202);}
  }
  const {data:latest,error}=await user.rpc('my_access_payment_orders');
  if(error)return reply({orderId,state:'processing'},202);
  return reply({orderId,state:latest?.find((o:{id:string})=>o.id===orderId)?.state??'processing'});
 }catch{return reply({error:'checkout_unavailable'},503);}
});
