-- =============================================================================
-- Table/sequence/function GRANTs.
--
-- Why this file exists: RLS policies only restrict WHICH ROWS a role can
-- see/touch — Postgres still requires the base object-level GRANT (SELECT/
-- INSERT/UPDATE/DELETE) before RLS is even evaluated. Supabase projects
-- normally get these grants automatically for anything created through
-- their dashboard/migration tooling, but tables created via raw SQL in the
-- SQL Editor can end up owned without the usual default privileges applied
-- — which is exactly what happened here (confirmed via the REST API
-- returning `permission denied for table X` — a base ACL error, distinct
-- from RLS's normal "0 rows" behavior — for both the `authenticated` and
-- `service_role` keys). This migration is idempotent and safe to re-run.
--
-- `anon` intentionally gets nothing: every protected route is already
-- gated by src/proxy.ts before any Supabase call happens, and the whole
-- data model assumes a logged-in `authenticated` user.
--
-- Run once, after 0001-0003.
-- =============================================================================

grant usage on schema public to anon, authenticated, service_role;

-- service_role: full access on every table (it still bypasses RLS via
-- BYPASSRLS, but the base ACL grant is a separate, still-required layer).
grant all privileges on
  public.roles,
  public.profiles,
  public.positions,
  public.selections,
  public.system_settings,
  public.activity_logs
to service_role;

-- authenticated: base grants only for what the app's direct (non-RPC)
-- client-side queries actually do. Row-level access is still fully
-- governed by the RLS policies from 0001/0002 — this just clears the
-- outer ACL gate so those policies get evaluated at all.
grant select on public.roles to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.positions to authenticated;
grant select on public.selections to authenticated;
grant select, update on public.system_settings to authenticated;
grant select, insert on public.activity_logs to authenticated;

-- Functions default to EXECUTE granted to PUBLIC (i.e. anon too) unless
-- explicitly revoked — tighten that here. Every RPC already checks
-- auth.uid()/is_admin() internally, so this was never exploitable, but an
-- anonymous caller shouldn't be able to invoke them at all as a matter of
-- defense in depth.
revoke execute on function public.select_position(uuid) from public;
revoke execute on function public.is_admin() from public;
revoke execute on function public.set_system_status(text) from public;
revoke execute on function public.get_current_turn() from public;
revoke execute on function public.set_selection_mode(text) from public;
revoke execute on function public.advance_turn(integer) from public;

grant execute on function public.select_position(uuid) to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.set_system_status(text) to authenticated;
grant execute on function public.get_current_turn() to authenticated;
grant execute on function public.set_selection_mode(text) to authenticated;
grant execute on function public.advance_turn(integer) to authenticated;
