-- =============================================================================
-- Register form was simplified to just ชื่อ-สกุล (name) + ลำดับอาวุโส
-- (seniority order) — plus email/password, which Supabase Auth always
-- needs. รหัสประจำตัว/รุ่น/ชั้นปี/หมวด-กลุ่ม are no longer collected; the
-- 0001 trigger already defaults those to '' / the auth user id, so no
-- schema change is needed for them. This migration just teaches
-- handle_new_user() to also read seniority_order out of the signUp
-- metadata, so it's set atomically at registration instead of requiring an
-- admin to assign it afterward via /admin/users (admins can still correct
-- it there any time).
--
-- Run once, after 0001_init.sql and 0002_seniority_queue.sql.
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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
