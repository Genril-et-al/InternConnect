-- Collect the skills the taxonomy could not place, in one place the admin can see.
--
-- These were previously written to each student's localStorage, which meant the
-- backlog `npm run skills:learn` works through was scattered across every
-- student's own browser and could never actually be collected.

create table if not exists public.skill_gaps (
  skill      text primary key,
  first_seen timestamptz not null default now(),
  last_seen  timestamptz not null default now(),
  times_seen integer     not null default 1
);

comment on table public.skill_gaps is
  'Skills seen on profiles/listings that skillTaxonomy.ts cannot place. Backlog for npm run skills:learn.';

alter table public.skill_gaps enable row level security;

-- Reads are admin-only. Reporting goes through record_skill_gaps() below, so no
-- insert/update policy is needed — the table is not writable directly.
drop policy if exists skill_gaps_admin_read on public.skill_gaps;
create policy skill_gaps_admin_read on public.skill_gaps
  for select to authenticated
  using (public.is_admin());

/**
 * Report a batch of unplaceable skills.
 *
 * SECURITY DEFINER so any signed-in user's browser can add to the backlog
 * without being able to read it back or edit rows directly. The table holds no
 * personal data — just the skill words themselves.
 *
 * These strings eventually reach an AI prompt in scripts/learnSkills.ts, so the
 * obvious junk is dropped here as well as there: blanks, over-long entries, and
 * anything containing newlines.
 */
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

  -- A page load reports a handful of new skills at most. Anything larger is not
  -- a real client, so take the first 100 and ignore the rest.
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
