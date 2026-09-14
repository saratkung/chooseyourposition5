# Position Selection System

Real-time online position selection — Next.js 16 (App Router) + TypeScript + Tailwind v4 + Supabase (Postgres, Auth, Realtime, RLS).

REGISTER → LOGIN → WAITING ROOM → POSITION SELECTION (realtime) → CONFIRM → DATABASE LOCK → MY POSITION, plus a full Admin console (dashboard, position management, system control, live monitor).

## 1. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run, in order:
   - [`database/migrations/0001_init.sql`](database/migrations/0001_init.sql) — all tables, RLS policies, the atomic `select_position()` function, audit-log triggers, and adds `positions` / `selections` / `system_settings` / `activity_logs` / `profiles` to the `supabase_realtime` publication.
   - [`database/migrations/0002_seniority_queue.sql`](database/migrations/0002_seniority_queue.sql) — adds the seniority-order turn queue (see below).
   - [`database/migrations/0003_seniority_at_registration.sql`](database/migrations/0003_seniority_at_registration.sql) — captures `seniority_order` directly at signup (register form was simplified — see below).
   - [`database/migrations/0004_grants.sql`](database/migrations/0004_grants.sql) — **required**: base table/function GRANTs for `authenticated`/`service_role`. Tables created via the SQL Editor don't always inherit Supabase's usual default privileges, and RLS alone isn't enough — Postgres checks the base GRANT before it ever evaluates a policy. Without this file the app will fail with "permission denied for table X" even for a logged-in user.
3. In **Project Settings → API**, copy the Project URL, anon public key, and service_role key.
4. In **Authentication → Providers → Email**, decide whether to require email confirmation. If left on, new users won't get a session immediately after `/register` and will be sent to `/login` with a "confirm your email" message instead.

## 2. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` (the service role key is only ever used by `scripts/seed.mjs`, never by the Next.js app itself — it's safe to leave blank if you don't run the seed script).

## 3. Install and run

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## 4. Seed demo data (optional but recommended)

```bash
npm run seed
```

Creates 1 admin, 20 demo users (assigned `seniority_order` 1-20), the 19 real ภาค 5 positions, and 8 sample selections made in seniority order through the real `select_position()` RPC. Login: `user01@position-system.demo` ... `user20@position-system.demo`, password `Demo1234!`. Admin: `admin@position-system.demo` / `Demo1234!`. The script leaves `system_status = waiting` (mode `seniority`, queue parked at seniority_order 9) with `open_at` ~5 minutes out, so flipping the system LIVE resumes the queue right where it left off.

## 5. Create an admin manually (without the seed script)

Register a normal account through `/register`, then in the Supabase SQL Editor:

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

They'll land on `/admin` on next login.

## Seniority queue (ลำดับอาวุโส)

`system_settings.selection_mode` is `open` (original free-for-all — anyone can click SELECT the instant the system is LIVE) or `seniority` (turn-based — only the officer whose `profiles.seniority_order` matches `system_settings.current_turn_seniority_order` may select; the queue auto-advances to the next not-yet-selected officer, by lowest `seniority_order`, the instant a selection succeeds).

- **Register form**: simplified to just ชื่อ / นามสกุล / ลำดับอาวุโส + Email/Password (Supabase Auth needs the latter two to log in at all) — each participant enters their own seniority number at signup, captured atomically by the `handle_new_user` trigger. A duplicate seniority number is rejected at signup (partial unique index) with a friendly error, so a typo can't silently collide with someone else's rank.
- **Correcting seniority later**: `/admin/users` — search a registered participant and edit their `Seniority Order` inline, or bulk-correct via **IMPORT CSV** with columns `email,seniority_order` (matched by email). **EXPORT CSV** dumps the current roster in the same format.
- **Turn the mode on**: `/admin/settings` → **SENIORITY QUEUE**. Switching in auto-starts the queue at the lowest `seniority_order` among participants who haven't selected yet.
- **Manual control**: the same panel shows who currently holds the turn (name + rank, via `get_current_turn()`, which deliberately exposes nothing else from `profiles`) with **ข้ามไปคิวถัดไป** (skip a no-show to the next rank) and a manual "set queue to rank N" override — both call the admin-only `advance_turn()` RPC.
- **What participants see** on `/positions`: a banner reading either "ถึงคิวของคุณแล้ว!" (their turn — SELECT is enabled) or "กำลังรอคิว — ขณะนี้ถึงคิวของ [name] (ลำดับที่ N)" (not their turn — every card shows "รอถึงคิวของคุณ" instead of a SELECT button). This banner and every card update live as the admin advances the queue or someone selects, same Realtime path as everything else.
- **Enforcement is server-side**: the turn check lives inside `select_position()` itself (`NOT_YOUR_TURN` error code) — disabling the button client-side is only a UX nicety, not the actual guard.
- A user with no `seniority_order` assigned can never select while the queue is active (they'll always get `NOT_YOUR_TURN`) — that's intentional; assign them a rank first.

## Testing real-time sync with two browsers

1. Run the seed script (or create ≥1 position + set `system_status = live` via `/admin/settings`).
2. Open `/positions` in two different browsers (or one normal + one incognito window), logged in as two different users.
3. In Browser A, click **SELECT** on an AVAILABLE position, confirm, and watch it turn 🔴 **TAKEN**.
4. Browser B's grid updates to 🔴 **TAKEN** immediately — no refresh. This is Supabase Realtime (`postgres_changes` on `public.positions`) driving `useRealtimePositions()`.
5. To see the race-condition guard, have both browsers open the confirm modal for the *same* position and hit **CONFIRM SELECTION** within the same second. Exactly one succeeds; the other gets **POSITION NO LONGER AVAILABLE**. This is enforced by `select_position()`'s `SELECT ... FOR UPDATE` row lock plus the partial unique indexes on `selections` — not by anything in the browser.
6. Toggle `/admin/settings` → PAUSE SYSTEM and watch both `/positions` tabs show "SYSTEM PAUSED" and disable SELECT, live.
7. **Seniority queue test**: switch to SENIORITY QUEUE mode. Log in as the officer NOT currently holding the turn — SELECT is disabled everywhere with "รอถึงคิวของคุณ". In `/admin/settings`, click **ข้ามไปคิวถัดไป** (or set the turn to their rank) — their `/positions` tab enables SELECT immediately, live, with no refresh.

## What's implemented

- **Auth**: Supabase Auth (email/password), `/register`, `/login`, `/forgot-password`. A DB trigger (`handle_new_user`) creates the `profiles` row atomically from `auth.users` metadata — no separate client round-trip that could leave an orphaned auth user.
- **Route protection**: `src/proxy.ts` (Next.js 16 renamed `middleware.ts` → `proxy.ts`) refreshes the Supabase session cookie and gates every protected route; `/admin/layout.tsx` additionally checks `profiles.role`.
- **Realtime**: `useRealtimePositions`, `useRealtimeSelections`, `useRealtimeSystem`, `useRealtimeActivityLogs`, `useRealtimeProfiles` — each subscribes on mount, updates React state from `postgres_changes` payloads, unsubscribes on unmount, and re-syncs from the database whenever the browser regains connectivity (`window.addEventListener('online', ...)`), so a dropped websocket never leaves the UI stale.
- **Atomic, race-safe selection**: `select_position(p_position_id)` — a `SECURITY DEFINER` Postgres function that locks the caller's own selection row, then `SELECT ... FOR UPDATE`s the target position row, checks status, and only then inserts the selection + flips the position to `taken`, inside one transaction. Backed by partial unique indexes (`one confirmed selection per user`, `one confirmed selection per position`) as a hard database-level backstop.
- **SELECTING (yellow) status**: implemented as an ephemeral Supabase Realtime *broadcast* (not a persisted DB status), so it can never leave a position stuck in a stale lock if someone closes the confirm modal or their tab crashes. AVAILABLE/TAKEN — the only states that matter for correctness — are always DB-sourced.
- **Seniority queue**: optional turn-based mode (`selection_mode = 'seniority'`) layered on top of the same atomic `select_position()` — see the dedicated section above.
- **Admin**: dashboard (live stats), position management (CRUD, search/filter, CSV import/export), user/seniority management (`/admin/users`), system control (`set_system_status()` RPC → WAITING/LIVE/PAUSED/FINISHED, plus queue mode controls), live activity monitor.
- **Audit log**: `activity_logs`, written automatically by DB triggers/functions for selections, position CRUD, and system-status changes (plus client-logged REGISTER/LOGIN), so it can't be bypassed or forgotten.
- **RLS everywhere**: every table has row level security enabled; see the policy list in the migration file for exactly what each role can read/write.

## What's intentionally simplified vs. the original spec

- **Register form fields**: per a later request, simplified down to ชื่อ / นามสกุล / ลำดับอาวุโส + Email/Password only. The `profiles` table still has `user_code` / `batch` / `class_year` / `group_name` columns from the original spec (harmless — `handle_new_user` defaults them to `''` / the auth user id when not supplied), they're just no longer collected or shown anywhere in the UI.
- **System control buttons**: the spec lists OPEN / PAUSE / RESUME / CLOSE / FINISH, but only 4 system statuses exist (`waiting/live/paused/finished`). CLOSE was consolidated into FINISH SYSTEM rather than inventing a 5th status not present in the DB schema section.
- **Pagination**: positions are fetched once via Realtime (not paginated at the DB query level) and paginated client-side in the grid — reasonable at "a few hundred rows," and the whole point of a Realtime subscription is that it wants the full live set anyway.

## Still to do before production

1. **Point at a real Supabase project.** `.env.local` currently has placeholder values — nothing will actually work until you complete Section 1–2 above.
2. **Run the two-browser real-time test and the race-condition test** described above against your real project (I verified the schema/RLS/RPC logic and the UI in isolation, but couldn't exercise the full live flow without a real Supabase backend in this environment).
3. **Decide on email confirmation** in Supabase Auth settings and adjust the register flow copy if you turn it on.
4. **Rate limiting / abuse protection** on `/register` and `/login` beyond Supabase Auth's own defaults, if this will be internet-facing.
5. **Custom SMTP** for Supabase Auth emails (password reset, confirmation) — the default Supabase email sender is low-volume and fine for testing only.
6. **Backups / point-in-time recovery** plan on the Supabase project once real selection data matters.
7. Replace the placeholder favicon/metadata and add a proper `og:image` if this will be shared publicly.
