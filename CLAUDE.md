# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

FreePaws (Province de Liège, Belgium): canine coaching + **FreePaws Park**, a fenced dog park booked
by private slots, with a "two-time" live camera. Everything user-facing is in **French**.

Three independent parts in one repo:

- Repo root (`*.html`, `Images/`, `Photos/`): static showcase site www.freepaws.be. No build.
- `mobile/`: Expo SDK 57 app (iOS/Android, web for previews). Has its own `AGENTS.md` (Expo rules).
- `supabase/`: Postgres schema, business rules, RLS, Edge Function, SQL tests.

The owner wants every change pushed to **`main`**.

**Never invent business content.** Everything shown in the app (offers, texts, durations, hours,
prices, rules) must come from www.freepaws.be or from the owner. When information is missing, show
nothing or fall back to the site's « Prendre rendez-vous » email button. Do not put placeholder values in
`supabase/seed.sql`. Test-only values belong inside `supabase/tests/*.test.sql`.

## Commands

```bash
# Backend (Docker needed for `supabase start`)
npx supabase start                                   # API :54321, Mailpit (OTP emails) :54324
npx supabase db reset --local                        # re-apply migrations + seed
supabase/tests/run.sh                                # SQL tests on a throwaway Postgres (needs PG binaries)
DATABASE_URL=postgres://... supabase/tests/run.sh    # same, against an existing empty DB (CI mode)
npx supabase gen types typescript --local > mobile/src/types/database.ts   # after every migration

# App (from mobile/)
npm start                    # Expo dev server; `npx expo start --web` for the browser
npm run check                # typecheck + lint + prettier --check + jest (what CI runs)
npx jest src/utils/dates.test.ts          # a single test file
npx jest -t "parseRange"                  # tests by name
npx expo install <pkg>       # always use this instead of npm install for deps
npx expo install --check     # SDK compatibility (also in CI)
python3 scripts/generate-icons.py ../FreePaws.png   # regenerate icons/splash from the logo
```

The app needs `mobile/.env.local` (copy `.env.example`); without the Supabase vars it shows a
"Configuration requise" screen. CI: `.github/workflows/ci.yml` (jobs `mobile` and `database`).

## Architecture

### Backend is the source of truth for booking rules

All booking logic lives in SQL (`supabase/migrations/`), not in the app:

- `resources` (the park, the coach) own an agenda. `appointments` is the agenda; the exclusion
  constraint `appointments_no_overlap` on `(resource_id, blocked)` makes double-booking impossible.
  `blocked` = `period` widened by `buffer_minutes` (travel time) and is computed by a trigger.
- Online booking is opt-in per service (`services.booking_enabled`, default false). When it is off,
  the app shows the description and a mailto button. `resources.is_open = false` makes
  `get_resource_status` return `not_open`, and there is no camera access (the park is not open yet).
- `services.mode`: `slot` = individual slots generated from `availability_rules` minus `blackouts`
  and existing appointments; `event` = group sessions (workshops) created by the admin, with
  `capacity` enforced by a locking trigger on `bookings`.
- Clients never write `appointments`/`bookings` directly (no RLS insert policy). They call the
  `security definer` RPCs: `get_available_slots`, `book_slot`, `book_event`, `cancel_booking`,
  `delete_my_account`. Cancelling a slot-mode booking cancels its appointment (frees the slot) and
  cancelling an appointment cancels its bookings, both via triggers.
- RPCs raise stable error codes (`slot_unavailable`, `cancellation_too_late`, …) as the message;
  `mobile/src/utils/errors.ts` maps them to French. Add both sides when adding a code.
- Execute rights are revoked from `public/anon/authenticated` for every function, then granted
  explicitly at the end of each migration. Remember this when adding a function, including those
  called by RLS policies (e.g. `is_admin()` must be executable by `anon`).
- Roles: `profiles.role` (`client`/`admin`). Users can update only `full_name` and `phone`
  (column grants); admin is granted from the Supabase dashboard.
- Times are `timestamptz`; availability rules are in `Europe/Brussels` local time.

### Notifications (`*_notifications.sql`, `functions/send-notifications`, `docs/NOTIFICATIONS.md`)

Triggers on `bookings` fill the `notifications` outbox (confirmation, reschedule, cancellation,
reminder `settings.reminder_hours` before, admin alerts to `settings.admin_email`). The Edge Function,
called every minute by pg_cron, claims due rows with `claim_notifications()` and sends them via Resend in
`profiles.language` (synced from the app). Without its secrets it answers 503 and the queue waits.

### Two-time camera (`supabase/migrations/*_park_live.sql`, `functions/live-stream`, `docs/CAMERA.md`)

`get_resource_status('park')` → `free | reserved | closed`. `camera_access('park')` → `public`
(park free), `private` (caller has the current booking), `admin`, or `denied`, plus an expiry
of 10 minutes at most. The Edge Function `live-stream` calls it with the caller's JWT and returns
HMAC-signed, short-lived HLS URLs; the video server must verify them. Without the
`CAMERA_BASE_URL`/`CAMERA_SIGNING_SECRET` secrets the app shows "Direct bientôt disponible".

### Mobile app

- `src/app/` holds routes only (Expo Router). Tabs: `(tabs)/_layout.tsx` uses `NativeTabs`;
  `(tabs)/_layout.web.tsx` is a JS bottom tab bar, because NativeTabs renders at the top on web.
  Large screens live in `src/screens/`.
- Data access goes through React Query hooks in `src/api/*`, with query keys centralised in
  `src/api/keys.ts`. Mutations invalidate bookings + slots + park status + agenda together.
- `src/lib/supabase.ts` is a typed client (`Database` from the generated `src/types/database.ts`).
  On native the session is stored chunked in SecureStore (`session-storage.ts`); on web in
  `localStorage` (`session-storage.web.ts`).
- Auth: email OTP (6-digit code, `sign-in.tsx`). `EXPO_PUBLIC_REVIEW_EMAIL` switches that single
  address to password sign-in for App Store / Play reviewers. A new user without a name is sent to
  `/profile?welcome=1`.
- Dates: always format through `src/utils/dates.ts` (Brussels time zone, `fr-BE`). PostgREST
  returns `tstzrange` as a string; parse it with `src/utils/range.ts`.
- Public content (park status, live view, catalogue, free slots) works without an account, as Apple
  requires. Sign-in is only asked for when booking.
- UI: brand tokens in `src/theme.ts` (cream/ink/olive/brass, Fraunces + Work Sans loaded per
  weight). Every data screen handles loading / error / empty / content via `components/state-views`.
  Use `lib/confirm.ts` for confirmations, because `Alert` with buttons does nothing on web.
- Lint (`eslint-config-expo`) rejects raw `'` in JSX text: use the typographic `’`.
- Store config: `app.config.ts` (bundle id `be.freepaws.app`, never change after first release),
  `eas.json` (`appVersionSource: remote`, env per profile). See `docs/STORES.md`.

## Expo rules (from `mobile/AGENTS.md`)

Expo changes every SDK: check the versioned docs (https://docs.expo.dev/versions/v57.0.0/) rather
than memory. Never hand-edit `ios/`/`android/` (Continuous Native Generation). Configure native
behaviour through `app.config.ts` and config plugins.
