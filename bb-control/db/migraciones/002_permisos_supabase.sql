-- En Supabase, la API pública (roles anon y authenticated) no tiene que ver nada:
-- la app entra directo con DATABASE_URL. En un Postgres común estos roles no existen y no hace nada.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on all tables in schema public from anon, authenticated;
    revoke all on all sequences in schema public from anon, authenticated;
    alter default privileges in schema public revoke all on tables from anon, authenticated;
    alter default privileges in schema public revoke all on sequences from anon, authenticated;
    alter default privileges in schema public revoke all on functions from anon, authenticated;
  end if;
end $$;
