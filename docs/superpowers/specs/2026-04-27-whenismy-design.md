# whenIsMy — Design Spec

**Date:** 2026-04-27
**Revised:** 2026-04-27 (post multi-agent review)
**Status:** Approved

---

## Overview

A web and mobile app where users enter their address and see upcoming garbage and recycling pickup days. Signed-in users can enable push notifications reminding them the night before each pickup.

**Target geography:** United States (v1)
**Platforms:** iOS, Android, Web (single Expo codebase)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Expo (React Native) — iOS, Android, Web |
| Backend / DB | Supabase (Postgres + Auth + Edge Functions + pg_cron) |
| Schedule data | Recollect / Wasteline API (commercial, requires API key) |
| Push notifications | Expo Push Notification Service (routes to APNs + FCM) |
| Timezone lookup | `tz-lookup` library — resolves lat/lng → IANA timezone |

---

## Architecture

### Two user modes

**Anonymous (no account)**
- Enter address → Recollect API lookup (via cached Edge Function proxy) → view schedule
- Nothing saved server-side
- No notifications available
- Conversion point: "Get reminders" banner on the schedule screen

**Authenticated (with account)**
- All anonymous features, plus:
- Address + preferences saved to Supabase
- Push notifications enabled
- Expo push token stored in a dedicated `push_tokens` table

### System flow

```
User enters address (normalized to lowercase trimmed form)
    ↓
Check place_lookup_cache (keyed on normalized address)
    ↓ cache miss
Supabase Edge Function proxies to Recollect API  (rate-limited, API key server-side only)
    ↓
Recollect returns place_id + lat/lng + schedule for next 60 days
    ↓
Timezone derived from lat/lng via tz-lookup  (not from state)
Result cached in place_lookup_cache for 24h
    ↓
App displays schedule (only pickup types returned by Recollect for this place)
    ↓  (if signed in)
pickup_events upserted in Supabase (unique on user_id, event_date, event_type, source)
user_preferences saved (address, timezone, notification_time)
notify_at recomputed and stored as timestamptz
Immediate schedule refresh triggered on first sign-up
    ↓
pg_cron runs every 30 minutes
    finds users where notify_at is within the past 30 minutes
    AND have a pickup event tomorrow
    AND no entry in notification_log for today (user's local date)
    ↓
Edge Function → Expo Push Notification Service → device
    ↓
Result + Expo ticket_id logged to notification_log
Delivery receipt polled from Expo receipts API after ~15 min; status updated
```

### Schedule refresh

Staggered refresh — not a single Sunday thundering herd. Each user is assigned a refresh slot based on `hashtext(user_id::text) % 2016` (2016 = 30-min slots per week), so refreshes spread evenly across the week. A pg_cron job runs every 30 minutes and processes the users whose slot matches the current 30-min window.

Refresh is also triggered immediately on:
- First account creation (so new users see a current schedule right away)
- Address change

### Timezones

Timezone is derived from the Recollect place's **lat/lng** using the `tz-lookup` library at address-save time. This is stored in `user_preferences.timezone`. State-based derivation is not used — it is wrong for multi-zone states (FL, TX, IN, KY, AK, AZ, etc.).

### notify_at computation

Rather than computing each user's notification window at query time, `notify_at` is pre-computed as a `timestamptz` whenever `notification_time` or `timezone` changes:

```sql
notify_at = (today AT TIME ZONE timezone + notification_time)
```

The cron query simply does `WHERE notify_at <= NOW() AND notify_at > NOW() - interval '30 minutes'` — no per-row timezone arithmetic at query time, and no boundary drift.

`notify_at` is recomputed daily by a separate lightweight pg_cron job (runs at 00:05 UTC).

### Address change flow

When a user updates their address:
1. New `place_id`, `lat/lng`, and `timezone` are resolved
2. Old `pickup_events` rows for this user are deleted
3. New `pickup_events` are fetched and inserted immediately
4. `notify_at` is recomputed
5. `manual_schedules` rows are soft-deleted (set `active = false`) — user prompted to re-enter if new address also lacks Recollect coverage
6. `notification_log` is retained (historical record)

---

## Data Model

### `user_preferences`

| Column | Type | Notes |
|---|---|---|
| `user_id` | uuid PK | FK → auth.users ON DELETE CASCADE |
| `street` | text | Encrypted at rest via pgsodium |
| `city` | text | |
| `state` | char(2) | e.g. `NY` |
| `recollect_place_id` | text | Resolved once on address save |
| `latitude` | numeric(9,6) | From Recollect; used for tz-lookup |
| `longitude` | numeric(9,6) | From Recollect; used for tz-lookup |
| `timezone` | text | IANA tz, e.g. `America/New_York` |
| `notification_time` | time | User's chosen local time, e.g. `20:00` |
| `notify_at` | timestamptz | Pre-computed next fire time; updated daily |
| `notifications_garbage` | boolean | Default true; only shown if place has this type |
| `notifications_recycling` | boolean | Default true; only shown if place has this type |
| `notifications_yard_waste` | boolean | Default false; only shown if place has this type |
| `supported_event_types` | text[] | Event types returned by Recollect for this place |
| `updated_at` | timestamptz | |

### `push_tokens`

Separate table so push tokens are never included in `SELECT *` queries on `user_preferences`.

| Column | Type | Notes |
|---|---|---|
| `user_id` | uuid PK | FK → auth.users ON DELETE CASCADE |
| `expo_push_token` | text | Rotated on each app launch |
| `updated_at` | timestamptz | |

### `pickup_events`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid | FK → auth.users ON DELETE CASCADE |
| `event_date` | date | |
| `event_type` | text | `garbage`, `recycling`, `yard_waste`, etc. |
| `source` | text | `recollect` or `manual` |
| `refreshed_at` | timestamptz | |

**Unique constraint:** `(user_id, event_date, event_type, source)` — all refreshes use `INSERT ... ON CONFLICT DO NOTHING`.

### `manual_schedules`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid | FK → auth.users ON DELETE CASCADE |
| `event_type` | text | CHECK IN (`garbage`, `recycling`, `yard_waste`) |
| `pickup_day` | text | CHECK IN (`monday`…`sunday`) |
| `frequency` | text | CHECK IN (`weekly`, `biweekly`) |
| `anchor_date` | date | Required for biweekly — the date of the first upcoming pickup, used to determine which week is "on" |
| `active` | boolean | Set false on address change |

`anchor_date` is collected in the manual entry UI as a "When is your next pickup?" date picker, shown only when frequency = bi-weekly.

### `notification_log`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid | FK → auth.users ON DELETE CASCADE |
| `sent_at` | timestamptz | |
| `event_type` | text | |
| `status` | text | `sent`, `failed`, `delivered`, `receipt_error` |
| `expo_ticket_id` | text | Returned by Expo on send; polled for final receipt |

**Unique constraint:** `(user_id, event_type, (sent_at AT TIME ZONE timezone)::date)` — enforced via `INSERT ... ON CONFLICT DO NOTHING` for idempotency.

**Retention:** rows older than 90 days are purged by a monthly pg_cron job.

### `place_lookup_cache`

| Column | Type | Notes |
|---|---|---|
| `address_key` | text PK | Normalized address (lowercase, trimmed) |
| `recollect_place_id` | text | |
| `latitude` | numeric(9,6) | |
| `longitude` | numeric(9,6) | |
| `timezone` | text | |
| `supported_event_types` | text[] | |
| `cached_at` | timestamptz | Entries expire after 24h |

### Row-Level Security

| Table | End-user policy | Service role |
|---|---|---|
| `user_preferences` | SELECT / INSERT / UPDATE own row | Full access |
| `push_tokens` | SELECT / INSERT / UPDATE own row | Full access |
| `pickup_events` | SELECT own rows | Full access |
| `manual_schedules` | SELECT / INSERT / UPDATE / DELETE own rows | Full access |
| `notification_log` | SELECT own rows only — no INSERT / UPDATE / DELETE | Full access |
| `place_lookup_cache` | SELECT only (no user writes) | Full access |

### Indexes

```sql
CREATE INDEX ON pickup_events (user_id, event_date);
CREATE INDEX ON notification_log (user_id, event_type, sent_at);
CREATE INDEX ON manual_schedules (user_id) WHERE active = true;
CREATE INDEX ON push_tokens (expo_push_token) WHERE expo_push_token IS NOT NULL;
CREATE INDEX ON user_preferences (notify_at) WHERE notify_at IS NOT NULL;
```

---

## Screens & Navigation

### 1. Home
- Fields: street address, city, state
- Single CTA: "Look up my schedule"
- Footer link: "Want reminders? Sign in →"
- No account required

### 2. Schedule
- Next pickup highlighted prominently (type + date)
- Upcoming list (type, date, days until)
- Only pickup types supported by the user's municipality are shown
- Notification upsell banner at bottom: "Get reminders the night before pickup — Sign in →"
- Top bar: "← Change address" | ⚙️ (settings, signed-in users only)
- Holiday disclaimer: "Schedules may shift on public holidays — check your municipality's website"

### 3. Sign Up / Sign In
- Triggered by tapping the notifications banner
- Framed around the benefit: "Never miss a pickup"
- Email + password (minimum 12 characters; checked against HIBP breach database via Supabase Auth)
- "Continue with Google" option
- Email verification required before notifications are enabled
- Toggle between sign-up and sign-in

### 4. Notifications (account-only)
- Toggle per pickup type — only types supported by the user's municipality are shown
- Configurable reminder time (single time for all types — per-type times deferred to v2)
- Accessible from Settings

### 5. Settings (account-only)
- Address display + "Change" link (triggers address change flow)
- Reminders row → navigates to Notifications screen
- Account section: email, change password, delete account
- Sign out

---

## Manual Entry Flow (Recollect fallback)

When a user's address is not found in the Recollect database:

1. **Not Found screen:** explains the situation, offers two paths:
   - "Enter my pickup days" → Manual Entry screen
   - "Request coverage for my area" → server-side Edge Function sends email to `support@whenismy.app` with city + state (rate-limited: 1 request per IP per hour)
2. **Manual Entry screen:** per pickup type (Garbage, Recycling, Yard Waste):
   - Toggle to enable
   - Day-of-week selector
   - Frequency: weekly or bi-weekly
   - If bi-weekly: "When is your next pickup?" date picker → stored as `anchor_date`
3. **Schedule screen:** works identically to Recollect-backed users. A small "✏️ Manually entered schedule" badge indicates the data source.

Manual schedules are stored in `manual_schedules` and used to generate `pickup_events` rows with `source = 'manual'`. Generation runs on save and on the weekly refresh slot. Bi-weekly events are generated by iterating from `anchor_date` in 14-day steps.

If Recollect later adds coverage for the user's municipality, they are prompted to migrate to automatic schedule data.

---

## Notification Flow (detail)

pg_cron schedule: every 30 minutes

```sql
-- Step 1: select candidates using pre-computed notify_at index
SELECT up.user_id, pt.expo_push_token, pe.event_type, pe.event_date, up.timezone
FROM user_preferences up
JOIN push_tokens pt ON pt.user_id = up.user_id
JOIN pickup_events pe ON pe.user_id = up.user_id
WHERE up.notify_at <= NOW()
  AND up.notify_at > NOW() - interval '30 minutes'
  AND pe.event_date = (NOW() AT TIME ZONE up.timezone)::date + 1
  AND (
    (pe.event_type = 'garbage'    AND up.notifications_garbage = true)
    OR (pe.event_type = 'recycling' AND up.notifications_recycling = true)
    OR (pe.event_type = 'yard_waste' AND up.notifications_yard_waste = true)
  )
  AND NOT EXISTS (
    SELECT 1 FROM notification_log nl
    WHERE nl.user_id = up.user_id
      AND nl.event_type = pe.event_type
      AND (nl.sent_at AT TIME ZONE up.timezone)::date
          = (NOW() AT TIME ZONE up.timezone)::date
  );

-- Step 2: batch-send to Expo Push API
-- Step 3: INSERT into notification_log with ON CONFLICT DO NOTHING
--         (unique constraint prevents double-sends if cron overlaps)
-- Step 4: poll Expo receipts API after ~15 min; update status + expo_ticket_id
```

---

## Security

### API key protection
- Recollect API key stored as a Supabase Edge Function secret (never in client code)
- Anonymous lookups are rate-limited: 10 requests/minute per IP, 100/day per IP
- Authenticated lookups: 50/day per `user_id`
- Identical address lookups served from `place_lookup_cache` (24h TTL) — no Recollect call

### Push token handling
- Tokens stored in `push_tokens` table (separate from `user_preferences`)
- Token rotated on each app launch
- Never returned in client-facing `SELECT *` queries
- Expo tokens are bearer-equivalent for sending — treat as secrets

### Auth hardening
- Minimum password length: 12 characters
- HIBP breach-password check enabled via Supabase Auth
- Email verification required before enabling notifications
- Login + signup endpoints rate-limited via Supabase Auth config
- Google OAuth: redirect URIs pinned; `aud` claim validated; account-linking by matching verified email only
- MFA: optional for v1, available via Supabase TOTP support

### Address PII
- `street` column encrypted at rest using pgsodium column-level encryption
- Full address (street + city + state) deleted on account deletion via ON DELETE CASCADE
- Backups follow Supabase's encryption-at-rest policy
- Data export endpoint provided (DSAR compliance)
- Privacy policy to disclose address storage before first save

### Web security
- HTTPS enforced; HSTS header set
- Content Security Policy header configured in Edge Function responses
- `manual_schedules` columns protected by DB-level CHECK constraints (see data model)

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Address not found in Recollect | Show fallback screen with manual entry option |
| Multiple address matches | Show picker for user to confirm the correct address |
| Push notification delivery failure | Retry once; log failure; remove invalid tokens (Expo flags them in receipts) |
| Recollect API down during schedule refresh | Keep showing cached data; skip this user's slot; retry at next weekly slot |
| User deletes app | Token becomes invalid; cron skips on next run; token purged after first failed receipt |
| User changes address | Delete old pickup_events; fetch new schedule immediately; soft-delete manual_schedules |
| Cron overlap | `INSERT ... ON CONFLICT DO NOTHING` on notification_log prevents double-sends |
| notify_at not recomputed (edge case) | Fallback: daily recompute job at 00:05 UTC catches any missed updates |

---

## Out of Scope (v1)

- Per-type notification times (deferred to v2)
- Multiple saved addresses per user
- Canada / Australia coverage (Recollect supports both; tz-lookup already handles lat/lng globally)
- Holiday schedule adjustments (in-app disclaimer added as mitigation)
- Native calendar integration
- Home screen widget

---

## Open Questions

- Recollect API pricing tier — confirm rate limits and per-call cost vs. expected lookup volume before launch
- Google OAuth setup — needs OAuth app credentials configured for iOS bundle ID and Android package name
- pgsodium availability — confirm Supabase project tier supports column-level encryption for `street`
