-- Migration 20260723074625_skill_gaps.sql
--
-- RECORD OF A MIGRATION APPLIED OUTSIDE THIS REPO. Recovered from the linked
-- project's migration history with `supabase migration fetch`; the body below is
-- verbatim what ran against the database.
--
-- It is the same change as 20260723080000_skill_gaps.sql (that file is the
-- commented original), applied by hand under an earlier timestamp before the
-- repo copy was pushed. Both versions are now marked applied in the history
-- table, so neither re-runs. This file exists so the local migrations directory
-- accounts for every remote version -- `supabase db push` refuses to run while
-- the remote history contains a version it cannot find locally.
--
-- Do not edit. See 20260723080000_skill_gaps.sql for the documented source.

create table if not exists public.skill_gaps (
  skill      text primary key,
  first_seen timestamptz not null default now(),
  last_seen  timestamptz not null default now(),
  times_seen integer     not null default 1
);

comment on table public.skill_gaps is
  'Skills seen on profiles/listings that skillTaxonomy.ts cannot place. Backlog for npm run skills:learn.';

alter table public.skill_gaps enable row level security;

drop policy if exists skill_gaps_admin_read on public.skill_gaps;
create policy skill_gaps_admin_read on public.skill_gaps
  for select to authenticated
  using (public.is_admin());

create or replace function public.record_skill_gaps(p_skills text[])
returns void
language plpgsql
security definer
set search_path = public
as $BODY$
begin
  if p_skills is null or array_length(p_skills, 1) is null then
    return;
  end if;

  insert into public.skill_gaps (skill)
  select distinct lower(btrim(s))
  from unnest(p_skills[1:100]) as s
  where btrim(s) <> ''
    and length(btrim(s)) <= 60
    and s !~ '[\n\r]'
  on conflict (skill) do update
    set last_seen  = now(),
        times_seen = public.skill_gaps.times_seen + 1;
end;
$BODY$;

revoke execute on function public.record_skill_gaps(text[]) from public, anon;
grant execute on function public.record_skill_gaps(text[]) to authenticated;
