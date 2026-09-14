-- =============================================================================
-- get_results() — a read-only, narrow join for the /results board that any
-- logged-in participant (not just admin) can see: every position, and who
-- (if anyone) confirmed-selected it. SECURITY DEFINER so it can join across
-- profiles without needing to broaden the profiles/selections RLS policies
-- (those stay locked to "own row or admin" as before) — this function is
-- the ONLY thing that exposes other participants' names, and only their
-- name + seniority rank, nothing else from their profile (no email, batch,
-- class_year, group_name, user_code).
--
-- Run once, after 0001-0005.
-- =============================================================================

create or replace function public.get_results()
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(jsonb_agg(row_to_json(r) order by r.position_code), '[]'::jsonb)
  from (
    select
      p.id as position_id,
      p.position_code,
      p.department,
      p.division,
      p.location,
      p.status,
      pr.first_name as selected_by_first_name,
      pr.last_name as selected_by_last_name,
      pr.seniority_order as selected_by_seniority_order,
      s.reference_code,
      s.selected_at
    from public.positions p
    left join public.selections s on s.position_id = p.id and s.status = 'confirmed'
    left join public.profiles pr on pr.user_id = s.user_id
  ) r;
$$;

revoke execute on function public.get_results() from public;
grant execute on function public.get_results() to authenticated;
