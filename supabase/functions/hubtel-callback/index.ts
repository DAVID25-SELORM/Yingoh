import { createClient } from '@supabase/supabase-js';
import { HubtelProvider,errorCode,readHubtelConfiguration,settlementState } from '../_shared/hubtel-provider.ts';
// Public wake-up endpoint, not a payment authorizer. The callback cannot supply
// financial truth; a server-to-server authenticated status query is mandatory.
Deno.serve(async request=>{
 if(request.method!=='POST')return new Response(null,{status:405});
 const order=new URL(request.url).searchParams.get('order');
 if(!order||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(order))return new Response(null,{status:400});
 try{
  const provider=new HubtelProvider(readHubtelConfiguration(key=>Deno.env.get(key)));
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
  const {data,error}=await db.rpc('claim_access_payment_verification',{p_order:order});
  if(error)return new Response(null,{status:503});
  if(!data)return new Response(null,{status:202});
  const result=await provider.handleCallback(data);
  const {data:created}=await db.from('access_payment_orders').select('created_at').eq('id',order).maybeSingle();
  const {error:settleError}=await db.rpc('settle_access_payment',{p_order:order,p_reference:result.reference,p_state:settlementState(result.state,created?.created_at),
   p_amount_minor:result.amountMinor,p_currency:result.currency});
  return new Response(null,{status:settleError?503:200});
 }catch(e){console.error(JSON.stringify({event:'hubtel_callback_unresolved',order,code:errorCode(e)}));return new Response(null,{status:503});}
});
