# Local-first, no sign-in wall — design spec

**Date:** 2026-10-25
**Status:** Approved by user, ready for implementation planning

## Problem

The app currently gates everything past the home screen behind email/password
sign-in: saving an address, seeing it again on relaunch, setting up push
reminders, and manual-entry fallback all require a `user_preferences` row
owned by an `auth.users` account created via `supabase.auth.signUp()`.

The product goal is for the app to feel like downloading a game: open it,
type an address, see pickups, save it — never see a login screen. Signing
in/up should not exist as a concept for most users.

## Decisions made during brainstorming

- **No recovery path.** Fully anonymous, no email/password at all. If local
  storage is cleared or the app is deleted, the saved address and reminders
  are gone. (Confirmed acceptable — pre-launch, no real users yet, no
  migration needed.)
- **Push reminders stay** — this is the main feature the app is built around.
- **Saving an address stays an explicit tap** (today's "Save as my address"
  banner), not an automatic save of every lookup.
- **Account tab stays**, minus sign-out (nothing to sign out of). "Delete my
  data" stays as the reset action.

## Core architecture: local-first, cloud only for reminders

Two independent pieces of state, instead of one `user` gate:

1. **Saved address + schedule** — lives entirely in device storage
   (AsyncStorage on native, localStorage on web). Saving is instant, offline,
   and account-free. Relaunching the app with a saved address goes straight
   to the schedule — no account needed to get this "remembers me" feel.

2. **Reminders** — the one feature that must work while the app is closed,
   so it's the only thing that talks to Supabase. Turning reminders on is
   the single trigger that creates a Supabase **anonymous** account
   (`supabase.auth.signInAnonymously()`), uploads the locally-saved address/
   schedule to `user_preferences`/`pickup_events`, and registers the push
   token. From that point the existing backend (RLS, `refresh-schedules`,
   `recompute-notify-at`, `send-notifications` cron trio) takes over
   unchanged — anonymous `auth.uid()` works identically to a password
   account for every existing policy and query.

Someone who only wants to check their schedule never creates a Supabase row,
never costs an extra Recollect API call beyond the lookup they triggered
themselves, and is invisible to the backend entirely. Only people who
actively choose reminders get an account.

### Why not keep everything local, including reminders?

Reminders have to fire even when the app isn't open — that requires a
server-side cron checking "who needs a notification in the next 30 minutes"
and a durable push token to send to. There's no way to do that from a closed
app. Expo's on-device scheduled notifications don't cover this: no web
support, iOS caps pending notifications at 64, and schedules go stale around
holiday shifts unless the app is reopened to recompute them — exactly the
pattern reminders exist to avoid depending on.

### Why not create the account at app launch for everyone (eager anonymous auth)?

Considered and rejected: it would mint an `auth.users` row and consume a
weekly `refresh-schedules` slot for every casual visitor, including people
who never return — unnecessary backend load and cost against a paid
Recollect key for users who get no benefit from it. Lazy creation (only on
"turn on reminders") keeps the backend population equal to the population
that actually uses the feature it exists for.

## Data flow

**Saving an address (no reminders):**
1. User looks up an address (existing stateless `lookupSchedule` call,
   already rate-limited by IP — unchanged).
2. Taps "Save as my address" → written to local storage. No network call.
3. On relaunch, if a local address exists, skip the entry screen and show
   the schedule. If the local copy is older than the existing 24h cache
   window, silently re-run `lookupSchedule` to refresh it in place.

**Turning on reminders (from Account tab or a save-flow follow-up):**
1. `ensureAnonymousUser()` — reuse existing session if present, otherwise
   `signInAnonymously()`.
2. Upload the local address + schedule via the existing `saveAddress()` /
   `savePickupEvents()` (or `saveManualSchedules()` for the manual-entry
   path) — unchanged functions, new call site.
3. `registerPushToken()` — already wired into `onAuthStateChange` in
   `auth-context.tsx`.
4. Navigate to `notifications.tsx` to choose event types / time.
5. From here, the backend cron trio keeps the schedule and notifications
   current with no further client involvement — unchanged.

**Manual entry fallback** (Recollect doesn't cover the address): the
recurring pattern is already computed client-side
(`generateEventsFromManual`). It now saves locally by default, the same as
a Recollect-covered address; reminders for it go through the same
"turn on reminders" flow.

**Deleting data:** always clears local storage. If a Supabase account
exists (reminders were on), also calls the existing `delete_user` RPC and
signs out of the anonymous session. Either way, lands back on the entry
screen with nothing saved.

## Account tab behavior

Reached whenever a local saved address exists, regardless of whether a
Supabase account exists:

- Address summary: always from local storage.
- Reminders section:
  - No Supabase account yet → single "Turn on reminders" row.
  - Account exists → today's toggle summary (garbage/recycling/yard waste),
    unchanged.
- No sign-out button (nothing to sign out of for a local-only user; an
  anonymous session has no user-facing "account" to leave).
- "Delete my data" as described above.

## Backend changes

**None.** Every RLS policy, every Edge Function, every cron job keys off
`auth.uid()`, which is identical for anonymous and (formerly) password
accounts. `slotForUser(uuid) % 336` staggering is unaffected. No migration
is needed since there are no real users yet.

## Files

**Remove:**
- `app/sign-in.tsx`, `app/sign-in.test.tsx`
- `app/check-email.tsx`
- `app/change-password.tsx`, `app/change-password.test.tsx`
- Their `<Stack.Screen>` entries in `app/_layout.tsx`; the change-password
  link in `app/(tabs)/account.tsx`

**Add:**
- `src/lib/saved-address.ts` (+ test) — `getSavedAddress()`,
  `saveAddressLocally()`, `clearSavedAddress()`, `isStale()`
- `src/lib/enable-reminders.ts` (+ test) — the shared flow:
  `ensureAnonymousUser()` → upload address/schedule → `registerPushToken()`

**Change:**
- `app/index.tsx` — redirect gate becomes local `savedAddress` presence
  instead of `user`; drop the "Have an account? Sign in" row;
  `SaveAddressBanner` no longer takes `userId`.
- `app/(tabs)/schedule.tsx` — read from `saved-address.ts` instead of
  `getPreferences(user.id)`; opportunistic refresh when stale.
- `app/(tabs)/account.tsx` — address from local store; reminders section
  branches on `user`; drop sign-out; delete flow handles local-only vs.
  account-backed cases.
- `app/address-not-found.tsx` — "Enter my pickup days" always navigates to
  `/manual-entry`, no `user` check.
- `app/manual-entry.tsx` — `handleSave` writes locally by default (drop the
  `if (!user) router.push('/sign-in')` guard); reminders go through
  `enable-reminders.ts`.
- `src/components/SaveAddressBanner.tsx` — local write only, no network, no
  `userId` prop.
- `src/lib/auth.ts` — drop `signUp`/`signIn`/`changePassword`; add
  `ensureAnonymousUser()`.
- `src/lib/auth-context.tsx` — drop the email-confirmation deep-link
  handling block (no more email sign-up to confirm).

**Unchanged:** everything in `supabase/`; `src/lib/user-api.ts` function
bodies (new call sites only); `src/lib/schedule-store.ts` (still used for
the transient multi-match-picker state during a lookup, separate from the
durable `saved-address.ts`).

## Testing

- Update existing tests for every changed file (most already mock
  `useAuth` / `user-api`; swap those mocks for the local-store equivalents).
- Add unit tests for `saved-address.ts` and `enable-reminders.ts`.
- Delete the three removed test files.
- No new pgTAP or Edge Function tests — backend is untouched.

## Out of scope

- Cross-device sync, account recovery, or any form of email/password auth.
- Any change to `supabase/migrations/`, `supabase/functions/`, or RLS.
- Abuse/rate-limiting hardening on `signInAnonymously()` itself — acceptable
  for now since account creation requires genuine engagement (turning on
  reminders), not just opening the app.
