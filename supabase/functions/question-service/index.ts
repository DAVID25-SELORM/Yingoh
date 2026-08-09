import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const url = Deno.env.get('SUPABASE_URL') ?? '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const origins = (Deno.env.get('ALLOWED_ORIGINS') ?? 'https://nursefaculty.org').split(',').map((v) => v.trim());
function cors(req: Request) { const o=req.headers.get('origin')??''; return {'Access-Control-Allow-Origin':origins.includes(o)?o:origins[0],'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'}; }
function json(req: Request,status:number,body:unknown){return new Response(JSON.stringify(body),{status,headers:{...cors(req),'Content-Type':'application/json'}});}
const sorted = (value: unknown) => Array.isArray(value) ? [...value].map(String).sort() : [];
const same = (a: unknown,b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function sanitizedQuestion(row: Record<string, any>) {
  const {
    correct_answer: _answer,
    rationale: _rationale,
    strategy: _strategy,
    reference_url: _reference,
    correct_answer_explanation: _correctExplanation,
    option_explanations: _optionExplanations,
    immediate_response: _immediateResponse,
    reference_urls: _references,
    quality_notes: _qualityNotes,
    reviewed_by: _reviewedBy,
    reviewed_at: _reviewedAt,
    clinical_review_status: _reviewStatus,
    ...safe
  } = row;
  if (safe.ngn_data && typeof safe.ngn_data === 'object') {
    const { correct_left: _left, correct_right: _right, correct: _matrix, highlights, ...ngnSafe } = safe.ngn_data;
    safe.ngn_data = {
      ...ngnSafe,
      ...(Array.isArray(highlights) ? { highlights: highlights.map(({ correct: _correct, ...item }: Record<string, any>) => item) } : {}),
    };
  }
  return safe;
}

function score(row: Record<string, any>, answer: Record<string, any>) {
  const type = row.question_type;
  if (type === 'mcq' || type === 'sata') return same(sorted(answer.ids), sorted(row.correct_answer?.ids));
  if (type === 'ordered_response') return same(answer.ngn ?? [], row.correct_answer?.order ?? []);
  if (type === 'bow_tie') return same(sorted(answer.ngn?.left), sorted(row.ngn_data?.correct_left)) && same(sorted(answer.ngn?.right), sorted(row.ngn_data?.correct_right));
  if (type === 'matrix') {
    const expected = row.ngn_data?.correct ?? {};
    return Object.keys(expected).length > 0 && Object.entries(expected).every(([key,value]) => answer.ngn?.[key] === value);
  }
  if (type === 'highlight') {
    const expected = (row.ngn_data?.highlights ?? []).filter((item: any) => item.correct).map((item: any) => item.id);
    return same(sorted(answer.ngn), sorted(expected));
  }
  return false;
}

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors(req)});
  if(req.method!=='POST')return json(req,405,{error:'Method not allowed'});
  const origin=req.headers.get('origin'); if(origin&&!origins.includes(origin))return json(req,403,{error:'Origin not allowed'});
  if(!url||!anonKey||!serviceKey)return json(req,503,{error:'Question service is unavailable.'});
  const authorization=req.headers.get('authorization')??'';
  const userClient=createClient(url,anonKey,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
  const {data:auth,error:authError}=await userClient.auth.getUser();
  if(authError||!auth.user)return json(req,401,{error:'Your session has expired. Please sign in again.'});
  const service=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  let body:Record<string,any>; try{body=await req.json();}catch{return json(req,400,{error:'Invalid request body.'});}
  const {data:accessLevel,error:levelError}=await userClient.rpc('current_question_access_level');
  if(levelError)return json(req,403,{error:'Question access could not be verified.'});
  const minimumPlans=Number(accessLevel)>=3?['free','starter','pro']:Number(accessLevel)>=2?['free','starter']:['free'];

  if(body.action==='list'){
    const limit=Math.min(Math.max(Number(body.limit)||500,1),1000);
    const offset=Math.max(Number(body.offset)||0,0);
    let query=service.from('questions').select('*').eq('status','published').in('minimum_plan',minimumPlans).order('created_at').range(offset,offset+limit-1);
    if(typeof body.topic==='string'&&body.topic)query=query.eq('topic',body.topic);
    if(typeof body.type==='string'&&body.type)query=query.eq('question_type',body.type);
    const {data,error}=await query;
    if(error){console.error('question list failed',{code:error.code});return json(req,500,{error:'Questions could not be loaded.'});}
    return json(req,200,{questions:(data??[]).map(sanitizedQuestion)});
  }

  if(body.action==='grade'){
    const questionId=String(body.questionId??'');
    if(!/^[0-9a-f-]{36}$/i.test(questionId)||!body.answer||typeof body.answer!=='object')return json(req,400,{error:'A valid question and answer are required.'});
    const {data:question,error}=await service.from('questions').select('*').eq('id',questionId).eq('status','published').in('minimum_plan',minimumPlans).single();
    if(error||!question)return json(req,404,{error:'Question is unavailable for your plan.'});
    const isCorrect=score(question,body.answer);
    if(body.sessionId){
      const {data:exam}=await service.from('exam_sessions').select('id,user_id,status,question_ids').eq('id',body.sessionId).eq('user_id',auth.user.id).eq('status','active').single();
      if(!exam||!Array.isArray(exam.question_ids)||!exam.question_ids.includes(questionId))return json(req,403,{error:'This question is not part of the active exam.'});
      const {data:prior}=await service.from('exam_session_answers').select('id').eq('session_id',exam.id).eq('question_id',questionId).maybeSingle();
      if(prior)return json(req,409,{error:'This exam answer was already submitted.'});
      await service.from('exam_session_answers').insert({session_id:exam.id,question_id:questionId,answer:body.answer,is_correct:isCorrect,time_taken_seconds:Math.max(0,Number(body.timeTakenSeconds)||0)});
    }else{
      await service.from('attempts').insert({user_id:auth.user.id,question_id:questionId,answer:body.answer,is_correct:isCorrect});
    }
    return json(req,200,{
      is_correct:isCorrect,
      correct_answer:question.correct_answer,
      rationale:question.rationale,
      strategy:question.strategy,
      reference_url:question.reference_url,
      correct_answer_explanation:question.correct_answer_explanation,
      option_explanations:question.option_explanations,
      immediate_response:question.immediate_response,
      reference_urls:question.reference_urls,
      reviewed_at:question.reviewed_at,
      ngn_data:question.ngn_data,
    });
  }
  return json(req,400,{error:'Unsupported action.'});
});
