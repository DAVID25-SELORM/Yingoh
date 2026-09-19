-- LOCAL ISOLATED REHEARSAL ONLY. Recheck restored rows, including circular FKs.
begin;
do $$ declare c record; begin
 for c in select conrelid::regclass as tbl, pg_get_constraintdef(oid) as definition
 from pg_constraint where contype='f' and connamespace in
 ('public'::regnamespace,'auth'::regnamespace,'storage'::regnamespace)
 loop
  execute format('alter table %s add constraint rehearsal_fk_check %s not valid', c.tbl, regexp_replace(c.definition,' NOT VALID$',''));
  execute format('alter table %s validate constraint rehearsal_fk_check', c.tbl);
  execute format('alter table %s drop constraint rehearsal_fk_check', c.tbl);
 end loop;
end $$;
rollback;
