-- =============================================================================
-- Fix: deleting a position always failed with a foreign key violation.
--
-- log_position_change()'s DELETE branch (0001_init.sql) inserted a new
-- activity_logs row referencing old.id — but by the time that AFTER DELETE
-- trigger runs, the position row is already gone, so activity_logs.position_id
-- (which references positions.id) can never point at it. This isn't a
-- pre-existing-data problem; it reproduces on every single position delete,
-- always, via /admin/positions or any other client.
--
-- Fix: log the deletion with position_id = null (activity_logs.position_id is
-- already nullable — ON DELETE SET NULL — for exactly this situation) and keep
-- position_code in metadata, which is all anything reads for a DELETED entry
-- anyway.
--
-- Run once, after 0001-0008.
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
    values (auth.uid(), 'POSITION_DELETED', null, jsonb_build_object('position_code', old.position_code));
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
