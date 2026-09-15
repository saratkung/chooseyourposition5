-- =============================================================================
-- Fix: seniority queue getting stuck on the first person even after their
-- selection succeeds.
--
-- Root cause: every read of "the" system_settings row (in select_position,
-- advance_turn, set_selection_mode, get_current_turn, set_system_status,
-- reset_selections, and the frontend's useRealtimeSystem) resolves it via
-- `order by updated_at desc limit 1` instead of a fixed id, because the
-- table was never constrained to hold exactly one row. If a second row ever
-- gets created (e.g. a race in set_system_status's "insert if none exists"
-- branch, or manual SQL), different calls can each resolve to a DIFFERENT
-- row depending on which was touched most recently. A user's select_position
-- call can then correctly advance current_turn_seniority_order on ITS row,
-- while the next person's turn-gate check reads a different, untouched row
-- still showing the first person's turn — the queue looks permanently stuck
-- even though the SQL logic advancing it is correct.
--
-- Fix: collapse to exactly one row (keeping whichever row every existing
-- "order by updated_at desc limit 1" read already treats as authoritative,
-- so this is a no-op for already-correct deployments) and add a unique
-- index that makes a second row structurally impossible going forward.
--
-- Run once, after 0001-0007.
-- =============================================================================

alter table public.system_settings
  add column if not exists singleton boolean not null default true;

do $$
declare
  v_keep_id uuid;
begin
  select id into v_keep_id from public.system_settings order by updated_at desc, id desc limit 1;
  if v_keep_id is not null then
    delete from public.system_settings where id <> v_keep_id;
  end if;
end $$;

alter table public.system_settings drop constraint if exists system_settings_singleton_check;
alter table public.system_settings add constraint system_settings_singleton_check check (singleton);

create unique index if not exists uq_system_settings_singleton
  on public.system_settings (singleton);

comment on column public.system_settings.singleton is
  'Always true. The unique index on this column enforces at most one system_settings row ever exists.';

-- =============================================================================
-- Secondary fix: reset_selections() docstring says it "restarts the
-- seniority queue at the top", but it actually set current_turn_seniority_order
-- to null, leaving the queue inactive (nobody's turn) until an admin
-- separately re-clicked the SENIORITY QUEUE mode button. Make the code match
-- the documented behavior: recompute the top of the queue the same way
-- set_selection_mode('seniority') does, when seniority mode is active.
-- =============================================================================

create or replace function public.reset_selections()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings_id uuid;
  v_mode text;
  v_next_turn integer;
  v_cleared integer;
begin
  if not public.is_admin() then
    return jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED', 'message', 'ต้องเป็นผู้ดูแลระบบเท่านั้น');
  end if;

  select count(*) into v_cleared from public.selections where status = 'confirmed';

  delete from public.selections where status = 'confirmed';

  update public.positions
  set status = 'available'
  where status in ('taken', 'selecting');

  select id, selection_mode into v_settings_id, v_mode
  from public.system_settings order by updated_at desc limit 1;

  if v_settings_id is not null then
    if v_mode = 'seniority' then
      select min(p.seniority_order) into v_next_turn
      from public.profiles p
      where p.seniority_order is not null and p.role = 'user';
      update public.system_settings set current_turn_seniority_order = v_next_turn where id = v_settings_id;
    else
      update public.system_settings set current_turn_seniority_order = null where id = v_settings_id;
    end if;
  end if;

  insert into public.activity_logs (user_id, action, metadata)
  values (auth.uid(), 'ADMIN_UPDATE', jsonb_build_object('action', 'RESET_SELECTIONS', 'cleared_count', v_cleared));

  return jsonb_build_object('success', true, 'cleared_count', v_cleared);
end;
$$;

revoke execute on function public.reset_selections() from public;
grant execute on function public.reset_selections() to authenticated;
