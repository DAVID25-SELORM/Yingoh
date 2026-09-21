import assert from 'node:assert/strict';
import {HubtelProvider,STALE_PROCESSING_MS,errorCode,normalizeStatus,readHubtelConfiguration,settlementState} from '../supabase/functions/_shared/hubtel-provider.ts';
const environment:Record<string,string>={
 HUBTEL_CLIENT_ID:'synthetic-id',HUBTEL_CLIENT_SECRET:'synthetic-secret',HUBTEL_MERCHANT_ID:'synthetic-merchant',
 HUBTEL_API_BASE_URL:'https://checkout.hubtel.com',HUBTEL_CALLBACK_URL:'https://example.test/functions/v1/hubtel-callback',
};
const config=()=>readHubtelConfiguration(key=>environment[key]);
const input={id:'00000000-0000-4000-8000-000000000001',amount_minor:21546,currency:'GHS',
 phone:'233200000000',channel:'mtn-gh',description:'30-Day Pass',provider_reference:'synthetic-transaction'};
const verified={clientReference:input.id,transactionAmount:215.46,currencyCode:'GHS',transactionId:input.provider_reference,
 status:'paid',disputed:false,totalAmountRefunded:0};
const mock=(data:unknown):typeof fetch=>()=>Promise.resolve(new Response(JSON.stringify({data})));
Deno.test('Hubtel runtime configuration missing/invalid fails closed without leaking values',()=>{
 assert.throws(()=>readHubtelConfiguration(()=>undefined),/provider_configuration_missing/);
 for(const changes of [{HUBTEL_API_BASE_URL:'https://hubtel.com.attacker.test'},{HUBTEL_CALLBACK_URL:'http://example.test'},
  {HUBTEL_API_BASE_URL:'https://checkout.hubtel.com/?secret=bad'},{HUBTEL_MERCHANT_ID:'../x'}]){
  const invalid:Record<string,string|undefined>={...environment,...changes};
  assert.throws(()=>readHubtelConfiguration(k=>invalid[k]),/provider_configuration_invalid/);
 }
});
Deno.test('Hubtel create sends only server price and configured callback, no zero charges',async()=>{
 let calls=0;
 const fetcher:typeof fetch=(_url,init)=>{
  calls++;const body=JSON.parse(String(init?.body));
  assert.equal(body.Amount,215.46);assert.equal(body.ClientReference,input.id);
  assert.equal(new URL(body.PrimaryCallbackUrl).searchParams.get('order'),input.id);
  assert.equal(init?.redirect,'error');
  return Promise.resolve(new Response(JSON.stringify({data:{transactionId:input.provider_reference,clientReferenceId:input.id}})));
 };
 const provider=new HubtelProvider(config(),fetcher);
 assert.equal((await provider.createPayment(input)).state,'processing');
 await assert.rejects(provider.createPayment({...input,amount_minor:0}),/invalid_payment/);assert.equal(calls,1);
});
Deno.test('Hubtel paid status requires matched gross amount, currency, reference and no dispute/refund',async()=>{
 assert.equal((await new HubtelProvider(config(),mock(verified)).verifyPayment(input)).state,'successful');
 for(const change of [{transactionAmount:1},{currencyCode:'USD'},{clientReference:'other'},{transactionId:'other'},
  {disputed:true},{totalAmountRefunded:1},{disputed:undefined}]){
  await assert.rejects(new HubtelProvider(config(),mock({...verified,...change})).verifyPayment(input));
 }
});
Deno.test('Hubtel callback is independently verified; unpaid/unknown are nonterminal',async()=>{
 const provider=new HubtelProvider(config(),mock({...verified,status:'pending'}));
 assert.equal((await provider.handleCallback(input)).state,'processing');
 assert.equal(normalizeStatus('unpaid'),'processing');assert.equal(normalizeStatus('unknown'),'processing');
 assert.equal(normalizeStatus('failed'),'failed');assert.equal(normalizeStatus('expired'),'expired');
});
Deno.test('Hubtel ambiguous initialization is never retried by provider',async()=>{
 let calls=0;const fetcher:typeof fetch=()=>{calls++;return Promise.reject(new Error('synthetic timeout'));};
 await assert.rejects(new HubtelProvider(config(),fetcher).createPayment(input),/provider_request_unconfirmed/);
 assert.equal(calls,1);
});
Deno.test('Hubtel response errors remain sanitized',async()=>{
 const fetcher:typeof fetch=()=>Promise.resolve(new Response('synthetic-secret',{status:500}));
 await assert.rejects(new HubtelProvider(config(),fetcher).verifyPayment(input),e=>{
  assert.equal((e as Error).message,'provider_request_unconfirmed');return true;
 });
});
Deno.test('unpaid orders are released only after a verified provider answer plus a full day; never earlier or for terminal states',()=>{
 const now=Date.parse('2026-09-22T12:00:00Z');
 const ago=(ms:number)=>new Date(now-ms).toISOString();
 assert.equal(settlementState('processing',ago(STALE_PROCESSING_MS+1000),now),'expired');
 assert.equal(settlementState('processing',ago(STALE_PROCESSING_MS-1000),now),'processing');
 assert.equal(settlementState('processing',null,now),'processing');
 assert.equal(settlementState('processing','not-a-date',now),'processing');
 assert.equal(settlementState('successful',ago(STALE_PROCESSING_MS*5),now),'successful');
 assert.equal(settlementState('failed',ago(STALE_PROCESSING_MS*5),now),'failed');
 assert.equal(errorCode(new Error('secret-detail')),'unknown');
});
