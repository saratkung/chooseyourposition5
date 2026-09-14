# Position Selection System

Real-time online position selection — Next.js 16 (App Router) + TypeScript + Tailwind v4 + Supabase (Postgres, Auth, Realtime, RLS).

REGISTER → LOGIN → WAITING ROOM → POSITION SELECTION (realtime) → CONFIRM → DATABASE LOCK → MY POSITION, plus a full Admin console (dashboard, position management, system control, live monitor).

## 1. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run the entire contents of [`database/migrations/0001_init.sql`](database/migrations/0001_init.sql) once. It creates all tables, RLS policies, the atomic `select_position()` function, audit-log triggers, and adds `positions` / `selections` / `system_settings` / `activity_logs` / `profiles` to the `supabase_realtime` publication.
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

Creates 1 admin, 20 demo users, 30 positions, and 8 sample selections (made through the real `select_position()` RPC). Login: `user01@position-system.demo` ... `user20@position-system.demo`, password `Demo1234!`. Admin: `admin@position-system.demo` / `Demo1234!`. The script leaves `system_status = waiting` with `open_at` ~5 minutes out so you can watch the waiting-room countdown.

## 5. Create an admin manually (without the seed script)

Register a normal account through `/register`, then in the Supabase SQL Editor:

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

They'll land on `/admin` on next login.

## Testing real-time sync with two browsers

1. Run the seed script (or create ≥1 position + set `system_status = live` via `/admin/settings`).
2. Open `/positions` in two different browsers (or one normal + one incognito window), logged in as two different users.
3. In Browser A, click **SELECT** on an AVAILABLE position, confirm, and watch it turn 🔴 **TAKEN**.
4. Browser B's grid updates to 🔴 **TAKEN** immediately — no refresh. This is Supabase Realtime (`postgres_changes` on `public.positions`) driving `useRealtimePositions()`.
5. To see the race-condition guard, have both browsers open the confirm modal for the *same* position and hit **CONFIRM SELECTION** within the same second. Exactly one succeeds; the other gets **POSITION NO LONGER AVAILABLE**. This is enforced by `select_position()`'s `SELECT ... FOR UPDATE` row lock plus the partial unique indexes on `selections` — not by anything in the browser.
6. Toggle `/admin/settings` → PAUSE SYSTEM and watch both `/positions` tabs show "SYSTEM PAUSED" and disable SELECT, live.

## What's implemented

- **Auth**: Supabase Auth (email/password), `/register`, `/login`, `/forgot-password`. A DB trigger (`handle_new_user`) creates the `profiles` row atomically from `auth.users` metadata — no separate client round-trip that could leave an orphaned auth user.
- **Route protection**: `src/proxy.ts` (Next.js 16 renamed `middleware.ts` → `proxy.ts`) refreshes the Supabase session cookie and gates every protected route; `/admin/layout.tsx` additionally checks `profiles.role`.
- **Realtime**: `useRealtimePositions`, `useRealtimeSelections`, `useRealtimeSystem`, `useRealtimeActivityLogs`, `useRealtimeProfiles` — each subscribes on mount, updates React state from `postgres_changes` payloads, unsubscribes on unmount, and re-syncs from the database whenever the browser regains connectivity (`window.addEventListener('online', ...)`), so a dropped websocket never leaves the UI stale.
- **Atomic, race-safe selection**: `select_position(p_position_id)` — a `SECURITY DEFINER` Postgres function that locks the caller's own selection row, then `SELECT ... FOR UPDATE`s the target position row, checks status, and only then inserts the selection + flips the position to `taken`, inside one transaction. Backed by partial unique indexes (`one confirmed selection per user`, `one confirmed selection per position`) as a hard database-level backstop.
- **SELECTING (yellow) status**: implemented as an ephemeral Supabase Realtime *broadcast* (not a persisted DB status), so it can never leave a position stuck in a stale lock if someone closes the confirm modal or their tab crashes. AVAILABLE/TAKEN — the only states that matter for correctness — are always DB-sourced.
- **Admin**: dashboard (live stats), position management (CRUD, search/filter, CSV import/export), system control (`set_system_status()` RPC → WAITING/LIVE/PAUSED/FINISHED), live activity monitor.
- **Audit log**: `activity_logs`, written automatically by DB triggers/functions for selections, position CRUD, and system-status changes (plus client-logged REGISTER/LOGIN), so it can't be bypassed or forgotten.
- **RLS everywhere**: every table has row level security enabled; see the policy list in the migration file for exactly what each role can read/write.

## What's intentionally simplified vs. the original spec

- **profiles fields**: the spec's DB field list (`year`, `group`) and its register-form field list (`รุ่น`, `ชั้นปี`, `หมวด/กลุ่ม`) don't fully line up. Implemented as `batch` (รุ่น), `class_year` (ชั้นปี), `group_name` (หมวด/กลุ่ม) to cover the full register form.
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
