import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test } from 'node:test';

test('qualified permission RPC preserves self/admin authorization and overrides', async () => {
  const db = new PGlite();
  const user = '00000000-0000-4000-8000-000000000001';
  const other = '00000000-0000-4000-8000-000000000002';
  try {
    await db.exec(`
      create schema auth;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
      create function public.has_role(text[]) returns boolean language sql stable as $$ select coalesce(current_setting('test.admin',true),'false')='true' $$;
      create table user_roles(user_id uuid,role_id integer);
      create table role_permissions(role_id integer,permission_id text);
      create table permissions(id text,label text,group_key text);
      create table user_permission_overrides(user_id uuid,permission_id text,effect text);
      insert into permissions values ('read','Read','content'),('write','Write','content'),('extra','Extra','system');
      insert into user_roles values ('${user}',1),('${user}',2);
      insert into role_permissions values (1,'read'),(2,'read'),(1,'write');
      insert into user_permission_overrides values ('${user}','write','deny'),('${user}','extra','allow');
      create function public.my_effective_permissions() returns table(permission_id text,label text,group_key text,source text)
      language plpgsql as $$ begin return query select * from public.admin_get_effective_permissions(auth.uid()); end $$;
    `);
    await db.exec(await readFile(new URL('../supabase/migrations/20260919180000_fix_effective_permissions_ambiguity.sql', import.meta.url),'utf8'));
    await assert.rejects(db.query('select * from my_effective_permissions()'), /Authentication required/);
    await db.query("select set_config('test.uid',$1,false)", [user]);
    const result = await db.query('select * from my_effective_permissions()');
    assert.deepEqual(result.rows, [
      {permission_id:'read',label:'Read',group_key:'content',source:'role'},
      {permission_id:'extra',label:'Extra',group_key:'system',source:'override'},
    ]);
    await assert.rejects(db.query('select * from admin_get_effective_permissions($1)',[other]), /Not authorized/);
    await db.query("select set_config('test.admin','true',false)");
    assert.deepEqual((await db.query('select * from admin_get_effective_permissions($1)',[other])).rows, []);
    // Reapplying the replacement is safe and leaves results unchanged.
    await db.exec(await readFile(new URL('../supabase/migrations/20260919180000_fix_effective_permissions_ambiguity.sql', import.meta.url),'utf8'));
    assert.deepEqual((await db.query('select * from my_effective_permissions()')).rows, result.rows);
  } finally { await db.close(); }
});
