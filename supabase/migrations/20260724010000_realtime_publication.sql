-- Realtime: publish the tables the app watches so every portal updates without
-- a page reload (see src/lib/realtime.ts).
--
-- Realtime applies each subscriber's RLS policies to INSERT and UPDATE events,
-- so a client is only told about rows it could already read. DELETE events are
-- the exception: they are not filtered by RLS. That is why replica identity is
-- deliberately left at its default (primary key only) — a delete then puts
-- nothing on the wire but the row's id, which the client uses purely as a
-- signal to refetch. Setting `replica identity full` on these tables would
-- broadcast the whole deleted row to every subscriber; don't.

do $$
declare
  t text;
begin
  foreach t in array array[
    'applications',
    'listings',
    'listing_requirements',
    'requirement_submissions',
    'notifications',
    'profiles',
    'companies',
    'skill_gaps'
  ]
  loop
    -- Skip anything this database doesn't have (and anything that is a view
    -- rather than a table — a view has no replication stream of its own), so
    -- the migration stays runnable against an older schema.
    if not exists (
      select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = t and c.relkind = 'r'
    ) then
      continue;
    end if;

    -- Adding a table that is already published raises; check first so this
    -- migration can be re-run.
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
