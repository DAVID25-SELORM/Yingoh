import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { dedupePlans } from '../src/utils/plans.js';

// ---------- migration ----------
const db = new PGlite();
after(() => db.close());
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
await db.exec(`
create table payment_plans(id uuid primary key default gen_random_uuid(),name text not null,price_usd numeric not null default 0,duration_days integer not null default 30,
 is_active boolean not null default true,sort_order integer not null default 0,created_at timestamptz not null default now(),
 audience text not null default 'student' check (audience in ('student','educator','institution','hospital','enterprise')));
create table invoices(id uuid primary key default gen_random_uuid(),plan_id uuid references payment_plans(id) on delete set null);
create table institution_accounts(id uuid primary key default gen_random_uuid(),plan_id uuid references payment_plans(id) on delete set null);
create table access_grants(id uuid primary key default gen_random_uuid(),plan_id uuid not null references payment_plans(id));
create table promo_codes(id uuid primary key default gen_random_uuid(),code text unique,restricted_plan_id uuid references payment_plans(id));
create table access_payment_orders(id uuid primary key default gen_random_uuid(),plan_id uuid not null references payment_plans(id));
`);
// 5 plans each stored twice (the production symptom), a case/space variant, an inactive duplicate, plus a same-name plan for another audience.
await db.exec(`
insert into payment_plans(id,name,price_usd,duration_days,is_active,sort_order,created_at,audience) values
 ('${id(1)}','Explorer Pass',0,36500,true,1,'2026-06-24T10:00:00Z','student'),
 ('${id(2)}','30-Day Pass',19,30,true,2,'2026-06-24T10:00:00Z','student'),
 ('${id(3)}','90-Day Success Plan',49,90,true,3,'2026-06-24T10:00:00Z','student'),
 ('${id(4)}','180-Day Master Plan',79,180,true,4,'2026-06-24T10:00:00Z','student'),
 ('${id(5)}','365-Day Faculty Pass',129,365,true,5,'2026-06-24T10:00:00Z','educator'),
 ('${id(12)}','Explorer Pass',0,36500,true,1,'2026-07-02T10:00:00Z','student'),
 ('${id(13)}','30-Day Pass',19,30,true,2,'2026-07-02T10:00:00Z','student'),
 ('${id(14)}','90-Day Success Plan',49,90,true,3,'2026-07-02T10:00:00Z','student'),
 ('${id(15)}','180-Day Master Plan',79,180,true,4,'2026-07-02T10:00:00Z','student'),
 ('${id(16)}','365-Day Faculty Pass',129,365,true,5,'2026-07-02T10:00:00Z','educator'),
 ('${id(23)}',' 30-day pass ',19,30,true,2,'2026-07-03T10:00:00Z','student'),
 ('${id(24)}','90-Day Success Plan',49,90,false,3,'2026-06-01T10:00:00Z','student'),
 ('${id(30)}','30-Day Pass',25,30,true,9,'2026-07-04T10:00:00Z','institution');
-- references that point at the DUPLICATE rows (the ones that must be repointed before deletion)
insert into invoices(plan_id) values('${id(13)}'),('${id(23)}'),('${id(2)}'),(null);
insert into institution_accounts(plan_id) values('${id(14)}'),('${id(24)}');
insert into access_grants(plan_id) values('${id(15)}'),('${id(16)}'),('${id(4)}');
insert into promo_codes(code,restricted_plan_id) values('ONE','${id(13)}'),('TWO',null),('THREE','${id(24)}');
insert into access_payment_orders(plan_id) values('${id(12)}'),('${id(14)}');
`);
const query = async (sql, args = []) => (await db.query(sql, args)).rows;
const migration = await readFile(new URL('../supabase/migrations/20260923010000_deduplicate_payment_plans.sql', import.meta.url), 'utf8');
const counts = async () => Object.fromEntries(await Promise.all(['invoices', 'institution_accounts', 'access_grants', 'promo_codes', 'access_payment_orders'].map(async t => [t, (await query(`select count(*)::int c from ${t}`))[0].c])));

// ---------- client helper ----------
const plan = (id, name, extra = {}) => ({ id, name, is_active: true, sort_order: 0, created_at: '2026-06-24T00:00:00Z', audience: 'student', ...extra });

test('every plan appears once, in sort order', () => {
  const rows = [plan('a1', '30-Day Pass', { sort_order: 2 }), plan('b1', '90-Day Success Plan', { sort_order: 3 }), plan('a2', '30-Day Pass', { sort_order: 2, created_at: '2026-07-02T00:00:00Z' }),
    plan('c1', 'Explorer Pass', { sort_order: 1 }), plan('b2', '90-Day Success Plan', { sort_order: 3, created_at: '2026-07-02T00:00:00Z' })];
  const result = dedupePlans(rows);
  assert.deepEqual(result.map(p => p.name), ['Explorer Pass', '30-Day Pass', '90-Day Success Plan']);
  assert.deepEqual(result.map(p => p.id), ['c1', 'a1', 'b1'], 'the oldest row of each plan is kept');
});

test('duplicates are matched ignoring case and surrounding spaces, but never across audiences', () => {
  const result = dedupePlans([plan('a', '30-Day Pass'), plan('b', ' 30-day pass '), plan('c', '30-Day Pass', { audience: 'institution' })]);
  assert.equal(result.length, 2);
  assert.deepEqual(result.map(p => p.audience).sort(), ['institution', 'student']);
});

test('the keeper rule is active first, then lowest sort_order, then oldest, then id (same as the migration)', () => {
  assert.equal(dedupePlans([plan('x', 'P', { is_active: false }), plan('y', 'P', { created_at: '2030-01-01T00:00:00Z' })])[0].id, 'y');
  assert.equal(dedupePlans([plan('x', 'P', { sort_order: 5 }), plan('y', 'P', { sort_order: 2 })])[0].id, 'y');
  assert.equal(dedupePlans([plan('x', 'P', { created_at: '2026-08-01T00:00:00Z' }), plan('y', 'P', { created_at: '2026-07-01T00:00:00Z' })])[0].id, 'y');
  assert.equal(dedupePlans([plan('b', 'P'), plan('a', 'P')])[0].id, 'a');
});

test('bad input is tolerated and rows without extra fields still work', () => {
  assert.deepEqual(dedupePlans(null), []); assert.deepEqual(dedupePlans(undefined), []); assert.deepEqual(dedupePlans([null, undefined]), []);
  assert.equal(dedupePlans([{ id: '1', name: 'A' }, { id: '2', name: 'A' }]).length, 1);
  const input = [plan('a', 'X'), plan('b', 'X')]; dedupePlans(input); assert.equal(input.length, 2, 'input is not mutated');
});

test('the migration merges duplicate plans, repoints every reference and keeps all dependent rows', async () => {
  const before = await counts();
  assert.equal((await query('select count(*)::int c from payment_plans'))[0].c, 13);
  await db.exec(migration);
  const plans = await query('select id,name,is_active,audience from payment_plans order by sort_order,audience,id');
  assert.deepEqual(plans.map(p => p.name), ['Explorer Pass', '30-Day Pass', '90-Day Success Plan', '180-Day Master Plan', '365-Day Faculty Pass', '30-Day Pass']);
  // keepers: the oldest active row of each group (the inactive 90-day row was older but is not active, so it loses)
  assert.deepEqual(plans.slice(0, 5).map(p => p.id), [id(1), id(2), id(3), id(4), id(5)]);
  assert.equal(plans[3].is_active && plans[2].is_active, true);
  // the institution plan with the same name is a different plan and survives
  assert.equal(plans.filter(p => p.name === '30-Day Pass').length, 2);
  // nothing that referenced a plan was lost or left dangling
  assert.deepEqual(await counts(), before);
  const orphans = await query(`select (select count(*) from invoices i where i.plan_id is not null and not exists(select 1 from payment_plans p where p.id=i.plan_id))
   + (select count(*) from institution_accounts i where i.plan_id is not null and not exists(select 1 from payment_plans p where p.id=i.plan_id))
   + (select count(*) from access_grants i where not exists(select 1 from payment_plans p where p.id=i.plan_id))
   + (select count(*) from promo_codes i where i.restricted_plan_id is not null and not exists(select 1 from payment_plans p where p.id=i.restricted_plan_id))
   + (select count(*) from access_payment_orders i where not exists(select 1 from payment_plans p where p.id=i.plan_id)) as n`);
  assert.equal(Number(orphans[0].n), 0);
  assert.deepEqual((await query('select plan_id from invoices where plan_id is not null order by plan_id')).map(r => r.plan_id), [id(2), id(2), id(2)]);
  assert.deepEqual((await query('select plan_id from institution_accounts order by plan_id')).map(r => r.plan_id), [id(3), id(3)]);
  assert.deepEqual((await query('select plan_id from access_grants order by plan_id')).map(r => r.plan_id), [id(4), id(4), id(5)]);
  assert.deepEqual((await query('select code,restricted_plan_id from promo_codes order by code')).map(r => [r.code, r.restricted_plan_id]), [['ONE', id(2)], ['THREE', id(3)], ['TWO', null]]);
  assert.deepEqual((await query('select plan_id from access_payment_orders order by plan_id')).map(r => r.plan_id), [id(1), id(3)]);
});

test('re-running is harmless and prices/other columns of kept plans are untouched', async () => {
  const snapshot = JSON.stringify(await query('select * from payment_plans order by id'));
  await db.exec(migration);
  assert.equal(JSON.stringify(await query('select * from payment_plans order by id')), snapshot);
  assert.equal(Number((await query("select price_usd from payment_plans where id=$1", [id(2)]))[0].price_usd), 19);
});

test('duplicates can no longer be created, including case and space variants, but other audiences can share a name', async () => {
  await assert.rejects(db.exec(`insert into payment_plans(name) values('30-Day Pass')`), /unique|duplicate/i);
  await assert.rejects(db.exec(`insert into payment_plans(name) values('  30-DAY PASS ')`), /unique|duplicate/i);
  await db.exec(`insert into payment_plans(name,audience) values('30-Day Pass','hospital')`);
  assert.equal((await query("select count(*)::int c from payment_plans where lower(btrim(name))='30-day pass'"))[0].c, 3);
});

test('a reference that would collide after repointing aborts the whole migration and changes nothing', async () => {
  const other = new PGlite();
  try {
    await other.exec(`
      create table payment_plans(id uuid primary key default gen_random_uuid(),name text not null,is_active boolean not null default true,sort_order integer not null default 0,
       created_at timestamptz not null default now(),audience text not null default 'student');
      create table seats(plan_id uuid primary key references payment_plans(id));
      insert into payment_plans(id,name,created_at) values('${id(1)}','Plan','2026-01-01'),('${id(2)}','Plan','2026-02-01');
      insert into seats values('${id(1)}'),('${id(2)}');`);
    await assert.rejects(other.exec(migration), /duplicate key|unique/i);
    await other.exec('rollback'); // the failed run leaves its transaction open; a migration runner rolls it back
    assert.equal((await other.query('select count(*)::int c from payment_plans')).rows[0].c, 2);
    assert.equal((await other.query('select count(*)::int c from seats')).rows[0].c, 2);
  } finally { await other.close(); }
});
