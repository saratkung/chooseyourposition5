-- =============================================================================
-- Seniority queue ("ลำดับอาวุโส") — adds a turn-based selection mode on top
-- of the existing open/simultaneous mode. Run once, after 0001_init.sql.
--
-- Design: system_settings.selection_mode is 'open' (original free-for-all,
-- default) or 'seniority'. In 'seniority' mode, select_position() only lets
-- through the caller whose profiles.seniority_order equals
-- system_settings.current_turn_seniority_order, and auto-advances the turn
-- to the next not-yet-selected officer (by lowest seniority_order) the
-- instant a selection succeeds. The original FOR UPDATE row lock and
-- partial unique indexes from 0001 remain the actual race-condition
-- defense underneath this — the turn check is an additional gate, not a
-- replacement for it.
-- =============================================================================

alter table public.profiles
  add column if not exists seniority_order integer;

create unique index if not exists uq_profiles_seniority_order
  on public.profiles (seniority_order) where (seniority_order is not null);

alter table public.system_settings
  add column if not exists selection_mode text not null default 'open'
    check (selection_mode in ('open', 'seniority')),
  add column if not exists current_turn_seniority_order integer;

-- =============================================================================
-- Guard privileged profile columns: only an admin (or the handle_new_user
-- trigger, which runs as SECURITY DEFINER and never fires an UPDATE) may
-- change role/status/seniority_order — otherwise a participant could simply
-- PATCH their own row and jump the queue via the existing "update own
-- profile" policy.
-- =============================================================================

create or replace function public.protect_privileged_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.uid() is only ever null for requests that never passed through an
  -- 'authenticated' user JWT in the first place — i.e. the service_role key
  -- (seed scripts, migrations), which already bypasses RLS entirely. Every
  -- 'authenticated'-role caller (the only role RLS lets reach this UPDATE at
  -- all) always has a non-null auth.uid(), so this can't be used by a
  -- logged-in participant to dodge the admin check below.
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  if new.role is distinct from old.role
     or new.status is distinct from old.status
     or new.seniority_order is distinct from old.seniority_order then
    raise exception 'Not permitted to change privileged profile fields';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_privileged_profile_fields on public.profiles;
create trigger trg_protect_privileged_profile_fields
  before update on public.profiles
  for each row execute function public.protect_privileged_profile_fields();

-- =============================================================================
-- select_position(): add the turn-gate check + auto-advance-on-success.
-- Replaces the 0001 definition; identical otherwise.
-- =============================================================================

create or replace function public.select_position(p_position_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_position public.positions%rowtype;
  v_system public.system_settings%rowtype;
  v_my_seniority integer;
  v_next_turn integer;
  v_reference text;
  v_selection_id uuid;
  v_already_selected boolean;
begin
  if v_user_id is null then
    return jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED',
      'message', 'กรุณาเข้าสู่ระบบก่อนทำรายการ');
  end if;

  select * into v_system from public.system_settings order by updated_at desc limit 1;
  if v_system.system_status is distinct from 'live' then
    return jsonb_build_object('success', false, 'error_code', 'SYSTEM_NOT_LIVE',
      'message', 'ระบบยังไม่เปิดให้เลือกตำแหน่งในขณะนี้');
  end if;

  if v_system.selection_mode = 'seniority' then
    select seniority_order into v_my_seniority from public.profiles where user_id = v_user_id;
    if v_my_seniority is null
       or v_system.current_turn_seniority_order is null
       or v_my_seniority <> v_system.current_turn_seniority_order then
      return jsonb_build_object('success', false, 'error_code', 'NOT_YOUR_TURN',
        'message', 'ยังไม่ถึงคิวของคุณ กรุณารอจนกว่าจะถึงลำดับอาวุโสของคุณ');
    end if;
  end if;

  -- Lock (and check) this user's own confirmed-selection slot first. Only
  -- ever contended by the same user's own concurrent requests (e.g. two
  -- open tabs), so this can never deadlock against another user's lock on
  -- a position row below.
  perform 1 from public.selections
    where user_id = v_user_id and status = 'confirmed'
    for update;

  select exists (
    select 1 from public.selections where user_id = v_user_id and status = 'confirmed'
  ) into v_already_selected;

  if v_already_selected then
    return jsonb_build_object('success', false, 'error_code', 'ALREADY_SELECTED',
      'message', 'คุณได้เลือกตำแหน่งไปแล้ว ไม่สามารถเลือกซ้ำได้');
  end if;

  -- Lock the target position row. If another transaction is mid-flight on
  -- the same position, this blocks until it commits/rolls back, then
  -- re-reads the fresh row below — that is what turns the millisecond race
  -- into a deterministic first-committer-wins outcome.
  select * into v_position from public.positions where id = p_position_id for update;

  if not found then
    return jsonb_build_object('success', false, 'error_code', 'POSITION_NOT_FOUND',
      'message', 'ไม่พบตำแหน่งนี้ในระบบ');
  end if;

  if v_position.status = 'disabled' then
    return jsonb_build_object('success', false, 'error_code', 'POSITION_DISABLED',
      'message', 'ตำแหน่งนี้ถูกปิดใช้งานชั่วคราว');
  end if;

  if v_position.status <> 'available' then
    return jsonb_build_object('success', false, 'error_code', 'POSITION_TAKEN',
      'message', 'ตำแหน่งนี้ถูกเลือกโดยผู้ใช้อื่นแล้ว');
  end if;

  v_reference := 'PS-' || to_char(now(), 'YYYY') || '-' ||
    lpad(nextval('public.selection_reference_seq')::text, 6, '0');

  insert into public.selections (user_id, position_id, status, reference_code, selected_at)
  values (v_user_id, p_position_id, 'confirmed', v_reference, now())
  returning id into v_selection_id;

  update public.positions set status = 'taken' where id = p_position_id;

  insert into public.activity_logs (user_id, action, position_id, metadata)
  values (v_user_id, 'SELECTION_SUCCESS', p_position_id,
    jsonb_build_object('reference_code', v_reference, 'position_code', v_position.position_code));

  if v_system.selection_mode = 'seniority' then
    select min(p.seniority_order) into v_next_turn
    from public.profiles p
    where p.seniority_order is not null
      and p.role = 'user'
      and not exists (
        select 1 from public.selections s where s.user_id = p.user_id and s.status = 'confirmed'
      );
    update public.system_settings set current_turn_seniority_order = v_next_turn where id = v_system.id;
  end if;

  return jsonb_build_object(
    'success', true,
    'selection_id', v_selection_id,
    'reference_code', v_reference,
    'position_code', v_position.position_code
  );
exception
  when unique_violation then
    -- Belt-and-suspenders: the partial unique indexes are the true source of
    -- truth if two requests from the SAME user race each other on two
    -- DIFFERENT positions (the "FOR UPDATE" lock above only serializes
    -- against rows that already exist, so it can't guard an empty result
    -- set). Inspect which index fired to return the right message rather
    -- than defaulting to "someone else took it".
    insert into public.activity_logs (user_id, action, position_id, metadata)
    values (v_user_id, 'SELECTION_FAILED', p_position_id, jsonb_build_object('reason', sqlerrm));
    if sqlerrm like '%uq_selections_one_per_user%' then
      return jsonb_build_object('success', false, 'error_code', 'ALREADY_SELECTED',
        'message', 'คุณได้เลือกตำแหน่งไปแล้ว ไม่สามารถเลือกซ้ำได้');
    end if;
    return jsonb_build_object('success', false, 'error_code', 'POSITION_TAKEN',
      'message', 'ตำแหน่งนี้ถูกเลือกโดยผู้ใช้อื่นแล้ว');
  when others then
    insert into public.activity_logs (user_id, action, position_id, metadata)
    values (v_user_id, 'SELECTION_FAILED', p_position_id, jsonb_build_object('reason', sqlerrm));
    return jsonb_build_object('success', false, 'error_code', 'SERVER_ERROR',
      'message', 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้ง');
end;
$$;

grant execute on function public.select_position(uuid) to authenticated;

-- =============================================================================
-- get_current_turn() — exposes ONLY the current turn holder's name + rank to
-- every authenticated user (so the waiting queue can show "รอคิวของ ..."
-- without granting read access to the full profiles table).
-- =============================================================================

create or replace function public.get_current_turn()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.system_settings%rowtype;
  v_profile public.profiles%rowtype;
begin
  select * into v_settings from public.system_settings order by updated_at desc limit 1;

  if v_settings.selection_mode is distinct from 'seniority' or v_settings.current_turn_seniority_order is null then
    return jsonb_build_object('active', false);
  end if;

  select * into v_profile from public.profiles
    where seniority_order = v_settings.current_turn_seniority_order and role = 'user'
    limit 1;

  return jsonb_build_object(
    'active', true,
    'seniority_order', v_settings.current_turn_seniority_order,
    'first_name', v_profile.first_name,
    'last_name', v_profile.last_name
  );
end;
$$;

grant execute on function public.get_current_turn() to authenticated;

-- =============================================================================
-- Admin controls for the queue.
-- =============================================================================

create or replace function public.set_selection_mode(p_mode text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_next_turn integer;
begin
  if not public.is_admin() then
    return jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED', 'message', 'ต้องเป็นผู้ดูแลระบบเท่านั้น');
  end if;

  if p_mode not in ('open', 'seniority') then
    return jsonb_build_object('success', false, 'error_code', 'INVALID_MODE', 'message', 'โหมดไม่ถูกต้อง');
  end if;

  select id into v_id from public.system_settings order by updated_at desc limit 1;
  if v_id is null then
    return jsonb_build_object('success', false, 'error_code', 'NOT_FOUND', 'message', 'ไม่พบการตั้งค่าระบบ');
  end if;

  if p_mode = 'seniority' then
    select min(p.seniority_order) into v_next_turn
    from public.profiles p
    where p.seniority_order is not null
      and p.role = 'user'
      and not exists (select 1 from public.selections s where s.user_id = p.user_id and s.status = 'confirmed');
    update public.system_settings set selection_mode = 'seniority', current_turn_seniority_order = v_next_turn where id = v_id;
  else
    update public.system_settings set selection_mode = 'open', current_turn_seniority_order = null where id = v_id;
  end if;

  insert into public.activity_logs (user_id, action, metadata)
  values (auth.uid(), 'ADMIN_UPDATE', jsonb_build_object('selection_mode', p_mode));

  return jsonb_build_object('success', true);
end;
$$;

grant execute on function public.set_selection_mode(text) to authenticated;

create or replace function public.advance_turn(p_to_seniority_order integer default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_current integer;
  v_next_turn integer;
begin
  if not public.is_admin() then
    return jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED', 'message', 'ต้องเป็นผู้ดูแลระบบเท่านั้น');
  end if;

  select id, current_turn_seniority_order into v_id, v_current
  from public.system_settings order by updated_at desc limit 1;
  if v_id is null then
    return jsonb_build_object('success', false, 'error_code', 'NOT_FOUND', 'message', 'ไม่พบการตั้งค่าระบบ');
  end if;

  if p_to_seniority_order is not null then
    v_next_turn := p_to_seniority_order;
  else
    select min(p.seniority_order) into v_next_turn
    from public.profiles p
    where p.seniority_order is not null
      and p.role = 'user'
      and p.seniority_order > coalesce(v_current, 0)
      and not exists (select 1 from public.selections s where s.user_id = p.user_id and s.status = 'confirmed');
  end if;

  update public.system_settings set current_turn_seniority_order = v_next_turn where id = v_id;

  insert into public.activity_logs (user_id, action, metadata)
  values (auth.uid(), 'ADMIN_UPDATE',
    jsonb_build_object('current_turn_seniority_order', v_next_turn, 'manual', p_to_seniority_order is not null));

  return jsonb_build_object('success', true, 'current_turn_seniority_order', v_next_turn);
end;
$$;

grant execute on function public.advance_turn(integer) to authenticated;
