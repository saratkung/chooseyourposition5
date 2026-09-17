-- One-off cleanup: remove the old ภาค 5 positions (and any selections
-- pointing at them) before importing the real ภาค 6 roster via
-- /admin/positions → IMPORT CSV (database/region6-positions.csv).
--
-- Run once in the Supabase SQL Editor, on the existing project. Scoped to
-- department = 'ภาค 5' only — does not touch profiles (registered users /
-- seniority_order), system_settings, or activity_logs (its position_id is
-- ON DELETE SET NULL, so the audit trail survives).
--
-- selections.position_id is ON DELETE RESTRICT, so selections referencing
-- these positions must be cleared first.

delete from public.selections
where position_id in (select id from public.positions where department = 'ภาค 5');

delete from public.positions
where department = 'ภาค 5';

-- Optional: if a seniority-queue round was in progress, restart the turn
-- pointer so the first ภาค 6 round starts clean. Safe to skip — the admin
-- can also just hit "รีเซ็ตรอบการเลือก" / set the turn manually from
-- /admin/settings instead.
-- update public.system_settings set current_turn_seniority_order = null;
