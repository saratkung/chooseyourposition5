-- =============================================================================
-- Admin control to open/close registration. Enforced in the database (the
-- handle_new_user trigger rejects the INSERT, which rolls back the entire
-- auth.users row Supabase Auth was about to create), not just hidden in the
-- UI — so it can't be bypassed by calling the Auth API directly.
--
-- Run once, after 0001-0004.
-- =============================================================================

alter table public.system_settings
  add column if not exists registration_open boolean not null default true;

-- handle_new_user(): same as 0003, plus the registration-open check.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_registration_open boolean;
begin
  select registration_open into v_registration_open
  from public.system_settings order by updated_at desc limit 1;

  -- No system_settings row yet (fresh project, before its first insert) ->
  -- treat as open, matching the column's own default.
  if v_registration_open is false then
    raise exception 'REGISTRATION_CLOSED';
  end if;

  insert into public.profiles (
    user_id, first_name, last_name, user_code, batch, class_year, group_name, email, seniority_order
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    coalesce(new.raw_user_meta_data ->> 'user_code', new.id::text),
    coalesce(new.raw_user_meta_data ->> 'batch', ''),
    coalesce(new.raw_user_meta_data ->> 'class_year', ''),
    coalesce(new.raw_user_meta_data ->> 'group_name', ''),
    new.email,
    case
      when new.raw_user_meta_data ->> 'seniority_order' ~ '^[0-9]+$'
        then (new.raw_user_meta_data ->> 'seniority_order')::integer
      else null
    end
  );
  return new;
end;
$$;

-- Public (anon-readable) check for the /register page, which renders
-- before anyone is authenticated so it can't rely on the normal
-- authenticated-only system_settings SELECT policy. Exposes nothing
-- except this one boolean.
create or replace function public.is_registration_open()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select registration_open from public.system_settings order by updated_at desc limit 1),
    true
  );
$$;

grant execute on function public.is_registration_open() to anon, authenticated;

-- Admin control, audit-logged like the other system-settings toggles.
create or replace function public.set_registration_open(p_open boolean)
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

  select id into v_id from public.system_settings order by updated_at desc limit 1;
  if v_id is null then
    return jsonb_build_object('success', false, 'error_code', 'NOT_FOUND', 'message', 'ไม่พบการตั้งค่าระบบ');
  end if;

  update public.system_settings set registration_open = p_open where id = v_id;

  insert into public.activity_logs (user_id, action, metadata)
  values (auth.uid(), 'ADMIN_UPDATE', jsonb_build_object('registration_open', p_open));

  return jsonb_build_object('success', true);
end;
$$;

revoke execute on function public.set_registration_open(boolean) from public;
grant execute on function public.set_registration_open(boolean) to authenticated;
