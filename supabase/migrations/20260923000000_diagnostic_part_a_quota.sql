begin;
-- Part A quota fix. The first version allocated Part A proportionally, which left Pharmacology with only 8
-- slots for Parts B-D although Part C alone needs 10 medication-calculation questions. For the standard
-- 100-question Part A, subtract the planned Part B/C/D allocation from each blueprint target instead:
--   Part B (30 clinical judgment): MoC 3, Safety 4, HP 2, Psych 3, Basic 2, Pharm 4, Risk 5, Phys 7
--   Part C (10 calculations):      Pharm 10
--   Part D (10 prioritization):    MoC 8, Phys 2
-- Other Part A sizes keep the proportional (largest-remainder) allocation. Same signature; no data changes.
create or replace function public.diagnostic_quota(p_part_a integer) returns table(sub_sort integer,sub_name text,quota integer)
language sql immutable set search_path=public as $$
 with planned(sub_name,reserved) as (values
  ('Management of Care',11),('Safety and Infection Prevention and Control',4),('Health Promotion and Maintenance',2),('Psychosocial Integrity',3),
  ('Basic Care and Comfort',2),('Pharmacological and Parenteral Therapies',14),('Reduction of Risk Potential',5),('Physiological Adaptation',9)),
 fixed as (select b.sub_sort,b.sub_name,(b.sub_target-pl.reserved)::integer q from public.diagnostic_blueprint() b join planned pl on pl.sub_name=b.sub_name),
 w as (select b.sub_sort,b.sub_name,b.sub_target::numeric*p_part_a/150 exact from public.diagnostic_blueprint() b),
 base as (select w.sub_sort,w.sub_name,floor(w.exact)::integer fl,w.exact-floor(w.exact) frac from w),
 ranked as (select base.*,row_number() over (order by base.frac desc,base.sub_name) rn,(p_part_a-(select sum(base.fl) from base))::integer leftover from base)
 select f.sub_sort,f.sub_name,f.q from fixed f where p_part_a=100
 union all
 select r.sub_sort,r.sub_name,r.fl+case when r.rn<=r.leftover then 1 else 0 end from ranked r where p_part_a<>100
$$;
revoke all on function public.diagnostic_quota(integer) from public,anon,authenticated;
commit;
