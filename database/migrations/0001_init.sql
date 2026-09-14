-- =============================================================================
-- Online Position Selection System — initial schema
-- Run once against a fresh Supabase project (SQL Editor, or `supabase db push`
-- if you link this repo with the Supabase CLI).
-- =============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- ENUM-like check constraints (kept as text + check so values are easy to
-- read in the dashboard, and so admin tooling doesn't need enum migrations).
-- ---------------------------------------------------------------------------

-- =============================================================================
-- TABLES
-- =============================================================================

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (name in ('user', 'admin')),
  description text
);

insert into public.roles (name, description) values
  ('user', 'Standard participant who can select one position'),
  ('admin', 'Full system administrator')
on conflict (name) do nothing;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  first_name text not null,
  last_name text not null,
  user_code text not null unique,
  batch text not null,
  class_year text not null,
  group_name text not null,
  email text not null,
  role text not null default 'user' references public.roles (name),
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_role on public.profiles (role);

create table if not exists public.positions (
  id uuid primary key default gen_random_uuid(),
  position_code text not null unique,
  department text not null,
  division text not null,
  location text not null,
  description text,
  capacity integer not null default 1 check (capacity >= 1),
  status text not null default 'available' check (status in ('available', 'selecting', 'taken', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_positions_status on public.positions (status);
create index if not exists idx_positions_department on public.positions (department);
create index if not exists idx_positions_code_search on public.positions using gin (to_tsvector('simple', position_code || ' ' || department || ' ' || division));

create sequence if not exists public.selection_reference_seq;

create table if not exists public.selections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  position_id uuid not null references public.positions (id) on delete restrict,
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  reference_code text not null unique,
  selected_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Database-enforced last line of defense: at most ONE confirmed selection
-- per user, and at most ONE confirmed selection per position. This makes the
-- race condition structurally impossible even if the RPC logic is bypassed.
create unique index if not exists uq_selections_one_per_user
  on public.selections (user_id) where (status = 'confirmed');
create unique index if not exists uq_selections_one_per_position
  on public.selections (position_id) where (status = 'confirmed');

create table if not exists public.system_settings (
  id uuid primary key default gen_random_uuid(),
  system_status text not null default 'waiting' check (system_status in ('waiting', 'live', 'paused', 'finished')),
  open_at timestamptz,
  close_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  action text not null,
  position_id uuid references public.positions (id) on delete set null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_logs_created_at on public.activity_logs (created_at desc);
create index if not exists idx_activity_logs_user on public.activity_logs (user_id);

-- =============================================================================
-- updated_at trigger helper
-- =============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_positions_updated_at on public.positions;
create trigger trg_positions_updated_at before update on public.positions
  for each row execute function public.set_updated_at();

drop trigger if exists trg_system_settings_updated_at on public.system_settings;
create trigger trg_system_settings_updated_at before update on public.system_settings
  for each row execute function public.set_updated_at();

-- =============================================================================
-- Auto-create profile on signup (reads metadata passed to supabase.auth.signUp)
-- Keeps "create auth user" + "create profile" atomic instead of two separate
-- client round-trips that could leave an orphaned auth user on failure.
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    user_id, first_name, last_name, user_code, batch, class_year, group_name, email
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    coalesce(new.raw_user_meta_data ->> 'user_code', new.id::text),
    coalesce(new.raw_user_meta_data ->> 'batch', ''),
    coalesce(new.raw_user_meta_data ->> 'class_year', ''),
    coalesce(new.raw_user_meta_data ->> 'group_name', ''),
    new.email
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- is_admin() helper — used throughout RLS policies
-- =============================================================================

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

-- =============================================================================
-- select_position(position_id) — the atomic, race-condition-proof core.
--
-- Runs as SECURITY DEFINER so it can take row locks and write across tables
-- in one transaction regardless of the caller's RLS grants; every check
-- inside is still keyed off auth.uid(), so a caller can only ever act as
-- themselves. Two concurrent calls for the same position will always
-- resolve to exactly one SUCCESS and one POSITION_TAKEN, because the
-- `select ... for update` on the position row serializes them.
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
grant execute on function public.is_admin() to authenticated;

-- =============================================================================
-- Admin-only mutation RPCs for system control (kept as functions, not raw
-- table UPDATEs, so every status change is audit-logged atomically).
-- =============================================================================

create or replace function public.set_system_status(p_status text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    return jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED', 'message', 'ต้องเป็นผู้ดูแลระบบเท่านั้น');
  end if;

  if p_status not in ('waiting', 'live', 'paused', 'finished') then
    return jsonb_build_object('success', false, 'error_code', 'INVALID_STATUS', 'message', 'สถานะไม่ถูกต้อง');
  end if;

  select id into v_id from public.system_settings order by updated_at desc limit 1;

  if v_id is null then
    insert into public.system_settings (system_status) values (p_status) returning id into v_id;
  else
    update public.system_settings set system_status = p_status where id = v_id;
  end if;

  insert into public.activity_logs (user_id, action, metadata)
  values (auth.uid(),
    case p_status
      when 'live' then 'SYSTEM_STARTED'
      when 'paused' then 'SYSTEM_PAUSED'
      when 'finished' then 'SYSTEM_FINISHED'
      else 'ADMIN_UPDATE'
    end,
    jsonb_build_object('system_status', p_status));

  return jsonb_build_object('success', true);
end;
$$;

grant execute on function public.set_system_status(text) to authenticated;

-- =============================================================================
-- Audit-log triggers for admin-driven position changes (INSERT/UPDATE/DELETE
-- via the Admin Position Management screen). SECURITY DEFINER so the log
-- write succeeds regardless of the caller's own INSERT grant on
-- activity_logs, which is intentionally locked down for direct clients.
-- =============================================================================

create or replace function public.log_position_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.activity_logs (user_id, action, position_id, metadata)
    values (auth.uid(), 'POSITION_CREATED', new.id, jsonb_build_object('position_code', new.position_code));
    return new;
  end if;

  if tg_op = 'DELETE' then
    insert into public.activity_logs (user_id, action, position_id, metadata)
    values (auth.uid(), 'POSITION_DELETED', old.id, jsonb_build_object('position_code', old.position_code));
    return old;
  end if;

  -- tg_op = 'UPDATE'
  -- Skip the transition made by select_position() itself (available -> taken)
  -- since that's already captured by a SELECTION_SUCCESS log entry.
  if old.status = 'available' and new.status = 'taken' then
    return new;
  end if;

  if new.status = 'disabled' and old.status <> 'disabled' then
    insert into public.activity_logs (user_id, action, position_id, metadata)
    values (auth.uid(), 'POSITION_DISABLED', new.id, jsonb_build_object('position_code', new.position_code));
  elsif old.status = 'disabled' and new.status <> 'disabled' then
    insert into public.activity_logs (user_id, action, position_id, metadata)
    values (auth.uid(), 'POSITION_ENABLED', new.id, jsonb_build_object('position_code', new.position_code));
  else
    insert into public.activity_logs (user_id, action, position_id, metadata)
    values (auth.uid(), 'POSITION_UPDATED', new.id, jsonb_build_object('position_code', new.position_code));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_log_position_insert on public.positions;
create trigger trg_log_position_insert after insert on public.positions
  for each row execute function public.log_position_change();

drop trigger if exists trg_log_position_update on public.positions;
create trigger trg_log_position_update after update on public.positions
  for each row execute function public.log_position_change();

drop trigger if exists trg_log_position_delete on public.positions;
create trigger trg_log_position_delete after delete on public.positions
  for each row execute function public.log_position_change();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

alter table public.roles enable row level security;
alter table public.profiles enable row level security;
alter table public.positions enable row level security;
alter table public.selections enable row level security;
alter table public.system_settings enable row level security;
alter table public.activity_logs enable row level security;

-- roles: readable by any authenticated user, no direct writes from clients
drop policy if exists "roles_select_authenticated" on public.roles;
create policy "roles_select_authenticated" on public.roles
  for select to authenticated using (true);

-- profiles: read own or admin reads all; users may only update a safe
-- subset of their own row (role/status changes must go through admin tools
-- and are additionally blocked in the app layer, not just RLS)
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin" on public.profiles
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- profiles are inserted by the handle_new_user() trigger (SECURITY DEFINER),
-- so no direct client INSERT policy is granted.

-- positions: any authenticated user can read; only admins can write
drop policy if exists "positions_select_authenticated" on public.positions;
create policy "positions_select_authenticated" on public.positions
  for select to authenticated using (true);

drop policy if exists "positions_insert_admin" on public.positions;
create policy "positions_insert_admin" on public.positions
  for insert to authenticated with check (public.is_admin());

drop policy if exists "positions_update_admin" on public.positions;
create policy "positions_update_admin" on public.positions
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "positions_delete_admin" on public.positions;
create policy "positions_delete_admin" on public.positions
  for delete to authenticated using (public.is_admin());

-- selections: users read their own, admins read all; all writes go through
-- select_position() (SECURITY DEFINER), so no INSERT/UPDATE/DELETE policy is
-- granted to regular authenticated clients — direct REST writes are blocked.
drop policy if exists "selections_select_own_or_admin" on public.selections;
create policy "selections_select_own_or_admin" on public.selections
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- system_settings: any authenticated user can read; status transitions go
-- through set_system_status() (SECURITY DEFINER) for atomic audit logging.
-- Admins may also directly update open_at/close_at scheduling fields.
drop policy if exists "system_settings_select_authenticated" on public.system_settings;
create policy "system_settings_select_authenticated" on public.system_settings
  for select to authenticated using (true);

drop policy if exists "system_settings_update_admin" on public.system_settings;
create policy "system_settings_update_admin" on public.system_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- activity_logs: users may read their own rows, admins read all. Clients may
-- insert only their own REGISTER/LOGIN rows (all other actions are written
-- server-side by SECURITY DEFINER functions).
drop policy if exists "activity_logs_select_own_or_admin" on public.activity_logs;
create policy "activity_logs_select_own_or_admin" on public.activity_logs
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "activity_logs_insert_own_auth_events" on public.activity_logs;
create policy "activity_logs_insert_own_auth_events" on public.activity_logs
  for insert to authenticated
  with check (user_id = auth.uid() and action in ('REGISTER', 'LOGIN'));

-- =============================================================================
-- REALTIME PUBLICATION
-- =============================================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'positions'
  ) then
    alter publication supabase_realtime add table public.positions;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'selections'
  ) then
    alter publication supabase_realtime add table public.selections;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'system_settings'
  ) then
    alter publication supabase_realtime add table public.system_settings;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'activity_logs'
  ) then
    alter publication supabase_realtime add table public.activity_logs;
  end if;

  -- Not explicitly required by spec, but enables the Admin Dashboard's
  -- "Total Users" stat to update live as people register (RLS still
  -- restricts what each subscriber actually receives).
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end;
$$;

-- Seed the single system_settings row if the table is empty.
insert into public.system_settings (system_status, open_at)
select 'waiting', now() + interval '1 hour'
where not exists (select 1 from public.system_settings);
