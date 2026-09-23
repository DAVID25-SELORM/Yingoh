// Synthetic isolated PostgreSQL only. No credentials, host mounts or network.
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {RBAC_ROLES} from '../src/data/rbac.js';
function docker(args,input=''){
 return new Promise((resolve,reject)=>{
  const child=spawn('docker',args,{stdio:['pipe','pipe','pipe'],windowsHide:true});let out='',err='';
  child.stdout.on('data',v=>{out+=v;});child.stderr.on('data',v=>{err+=v;});child.on('error',reject);
  child.on('close',code=>code===0?resolve(out.trim()):reject(new Error(
   (out.match(/^MIGRATION .+$/gm)?.at(-1)??'')+'\n'+(err||out))));child.stdin.on('error',()=>{});child.stdin.end(input);
 });
}
test('complete migration history: fresh install and base-commit upgrade',{timeout:600000},async t=>{
 let container;
 try{
  container=await docker(['run','--detach','--rm','--network','none','--user','postgres','--name','nclex-access-rehearsal-'+randomUUID(),
   '--label','com.nursefaculty.test=access-migration-rehearsal','--tmpfs','/tmp:rw,mode=1777','--entrypoint','sh',
   'public.ecr.aws/supabase/postgres:17.6.1.167','-c',
   "initdb -D /tmp/rehearsal-pg -U postgres -A trust --no-locale >/dev/null && exec postgres -D /tmp/rehearsal-pg -k /tmp -c listen_addresses='' -c fsync=off"]);
  assert.match(container,/^[a-f0-9]{64}$/);
  const sql=(input,database='postgres')=>docker(['exec','-i',container,'psql','-h','/tmp','-U','postgres','-d',database,'-X','-qAt','-v','ON_ERROR_STOP=1'],input);
  let ready=false;for(let i=0;i<60;i++){try{await sql('select 1');ready=true;break;}catch{await new Promise(r=>setTimeout(r,250));}}
  assert.equal(ready,true);
  await sql('create role anon;create role authenticated;create role service_role bypassrls;create database fresh;create database upgrade;');
  const bootstrap=[
   'create schema auth;create schema extensions;',
   // Supabase includes extensions in the default migration search path.
   'alter database fresh set search_path=public,extensions;alter database upgrade set search_path=public,extensions;set search_path=public,extensions;',
   'create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default \'{}\',email_confirmed_at timestamptz,banned_until timestamptz,deleted_at timestamptz,invited_at timestamptz,encrypted_password text,last_sign_in_at timestamptz);',
   "create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;",
   "create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;",
   "create function auth.role() returns text language sql stable as $$ select current_user::text $$;",
   'grant usage on schema public,auth to authenticated,service_role;',
  ].join('\n');
  const directory=new URL('../supabase/migrations/',import.meta.url);
  const files=(await readdir(directory)).filter(f=>f.endsWith('.sql')).sort();
  const base=files.filter(f=>f<'20260919220000'),additional=files.filter(f=>f>='20260919220000');
  async function apply(files,database){
   // One psql session avoids hundreds of Docker process startups. Markers
   // identify the failing file without altering any migration statements.
   let script='set client_min_messages=warning;\n';
   for(const file of files){
    script+='\\echo MIGRATION '+file+'\n'+await readFile(new URL(file,directory),'utf8')+'\n';
   }
   await sql(script,database);
  }
  await t.test('fresh install applies every repository migration',async()=>{
   await sql(bootstrap,'fresh');await apply(files,'fresh');
   assert.equal(await sql('select complimentary_access_enabled or promo_codes_enabled or hubtel_payments_enabled from access_system_controls','fresh'),'f');
  });
  // Drift guard: the role/permission matrix shown in the app (src/data/rbac.js) must equal the database seed.
  await t.test('frontend role matrix equals the database role_permissions after the full migration chain',async()=>{
   const rows=await sql("select r.name||'='||coalesce(string_agg(rp.permission_id,',' order by rp.permission_id),'') from roles r left join role_permissions rp on rp.role_id=r.id group by r.name order by r.name",'fresh');
   const database=Object.fromEntries(rows.split('\n').filter(Boolean).map(line=>{const [name,list]=line.split('=');return [name,list?list.split(','):[]];}));
   const frontend=Object.fromEntries(RBAC_ROLES.map(role=>[role.name,[...role.permissions].sort()]));
   assert.deepEqual(Object.keys(database).sort(),Object.keys(frontend).sort());
   for(const name of Object.keys(frontend))assert.deepEqual(database[name],frontend[name],'permission drift for role '+name);
  });
  await t.test('upgrade preserves baseline rows and controls remain paused',async()=>{
   await sql(bootstrap,'upgrade');await apply(base,'upgrade');
   const before=await sql('select count(*) from questions','upgrade');
   await apply(additional,'upgrade');
   assert.equal(await sql('select count(*) from questions','upgrade'),before);
   assert.equal(await sql('select complimentary_access_enabled or promo_codes_enabled or hubtel_payments_enabled from access_system_controls','upgrade'),'f');
  });
 }finally{
  if(container&&/^[a-f0-9]{64}$/.test(container))await docker(['stop','--time','1',container]);
 }
});
