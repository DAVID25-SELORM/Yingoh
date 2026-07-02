-- Defense in depth: the public marketing/auth screen does not need direct table access.
-- RLS already protects rows; these grants ensure anonymous clients cannot query app tables.
revoke all privileges on all tables in schema public from anon;
revoke all privileges on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon;

alter default privileges in schema public
  revoke all on tables from anon;

alter default privileges in schema public
  revoke all on sequences from anon;

alter default privileges in schema public
  revoke execute on functions from anon;

grant usage on schema public to anon;
