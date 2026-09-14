-- =============================================================================
-- reset_selections() — admin-only "start the selection round over" action.
--
-- Scoped deliberately narrow: clears confirmed selections and puts every
-- non-disabled position back to AVAILABLE, and restarts the seniority
-- queue at the top. It does NOT touch profiles (registered users / their
-- seniority_order stay exactly as they are), does NOT touch
-- registration_open, and does NOT touch system_status or selection_mode —
-- those are the admin's separate, deliberate choices. activity_logs is
-- untouched too (the audit trail of who picked what before the reset
-- survives, since selections.user_id/position_id are just references, not
-- what's logged — the log rows themselves live independently).
--
-- Run once, after 0001-0006.
-- =============================================================================

create or replace function public.reset_selections()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings_id uuid;
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

  select id into v_settings_id from public.system_settings order by updated_at desc limit 1;
  if v_settings_id is not null then
    update public.system_settings set current_turn_seniority_order = null where id = v_settings_id;
  end if;

  insert into public.activity_logs (user_id, action, metadata)
  values (auth.uid(), 'ADMIN_UPDATE', jsonb_build_object('action', 'RESET_SELECTIONS', 'cleared_count', v_cleared));

  return jsonb_build_object('success', true, 'cleared_count', v_cleared);
end;
$$;

revoke execute on function public.reset_selections() from public;
grant execute on function public.reset_selections() to authenticated;
