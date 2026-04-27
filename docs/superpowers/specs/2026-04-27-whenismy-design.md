# whenIsMy — Design Spec

**Date:** 2026-04-27
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

---

## Architecture

### Two user modes

**Anonymous (no account)**
- Enter address → Recollect API lookup → view schedule
- Nothing saved server-side
- No notifications available
- Conversion point: "Get reminders" banner on the schedule screen

**Authenticated (with account)**
- All anonymous features, plus:
- Address + preferences saved to Supabase
- Push notifications enabled
- Expo push token stored server-side for reliable delivery

### System flow

```
User enters address
    ↓
Supabase Edge Function proxies to Recollect API  (protects API key)
    ↓
Recollect returns place_id + schedule for next 60 days
    ↓
App displays schedule
    ↓  (if signed in)
pickup_events cached in Supabase for 60 days
user_preferences saved (address, timezone, notification_time, expo_push_token)
    ↓
pg_cron runs every 30 minutes
    finds users whose notification_time falls in the current window
    AND have a pickup event tomorrow
    ↓
Edge Function → Expo Push Notification Service → device
    ↓
Result logged to notification_log
```

### Schedule refresh

A weekly pg_cron job (runs Sunday at 2am UTC) refreshes `pickup_events` for all active users by re-calling the Recollect API. This keeps schedules current without hitting the API on every page view.

### Timezones

User's timezone is derived from their state on address save (e.g., `NY` → `America/New_York`). `notification_time` is stored as a local time string (`20:00`). The cron job converts to UTC at query time to find users whose window is now.

---

## Data Model

### `user_preferences`

| Column | Type | Notes |
|---|---|---|
| `user_id` | uuid PK | FK → auth.users |
| `street` | text | |
| `city` | text | |
| `state` | char(2) | e.g. `NY` |
| `recollect_place_id` | text | Resolved once on address save |
| `timezone` | text | Derived from state, e.g. `America/New_York` |
| `notification_time` | time | User's chosen local time, e.g. `20:00` |
| `notifications_garbage` | boolean | Default true |
| `notifications_recycling` | boolean | Default true |
| `notifications_yard_waste` | boolean | Default false |
| `expo_push_token` | text | Nullable; set when notifications enabled |
| `updated_at` | timestamptz | |

### `pickup_events`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid | FK → auth.users |
| `event_date` | date | |
| `event_type` | text | `garbage`, `recycling`, `yard_waste`, etc. |
| `source` | text | `recollect` or `manual` |
| `refreshed_at` | timestamptz | |

### `manual_schedules`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid | FK → auth.users |
| `event_type` | text | `garbage`, `recycling`, `yard_waste` |
| `pickup_day` | text | Day of week: `monday`…`sunday` |
| `frequency` | text | `weekly` or `biweekly` |
| `active` | boolean | |

### `notification_log`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid | |
| `sent_at` | timestamptz | |
| `event_type` | text | |
| `status` | text | `sent` or `failed` |

Row-level security on all tables: users can only read and write their own rows.

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
- Notification upsell banner at bottom: "Get reminders the night before pickup — Sign in →"
- Top bar: "← Change address" | ⚙️ (settings, signed-in users only)

### 3. Sign Up / Sign In
- Triggered by tapping the notifications banner
- Framed around the benefit: "Never miss a pickup"
- Email + password
- "Continue with Google" option
- Toggle between sign-up and sign-in

### 4. Notifications (account-only)
- Toggle per pickup type: Garbage, Recycling, Yard Waste
- Configurable reminder time (single time for all types — per-type times deferred to v2)
- Accessible from Settings

### 5. Settings (account-only)
- Address display + "Change" link
- Reminders row → navigates to Notifications screen
- Account section: email, change password
- Sign out

---

## Manual Entry Flow (Recollect fallback)

When a user's address is not found in the Recollect database:

1. **Not Found screen:** explains the situation, offers two paths:
   - "Enter my pickup days" → Manual Entry screen
   - "Request coverage for my area" → sends an email to a configured address (e.g. support@whenismy.app) with the user's city + state; no database table needed for v1
2. **Manual Entry screen:** per pickup type (Garbage, Recycling, Yard Waste):
   - Toggle to enable
   - Day-of-week selector
   - Frequency: weekly or bi-weekly
3. **Schedule screen:** works identically to Recollect-backed users. A small "✏️ Manually entered schedule" badge indicates the data source.

Manual schedules are stored in `manual_schedules` and used to generate `pickup_events` rows with `source = 'manual'`. The notification cron job is source-agnostic and works identically for both.

If Recollect later adds coverage for the user's municipality, they are prompted to migrate to automatic schedule data.

---

## Notification Flow (detail)

pg_cron schedule: every 30 minutes

```sql
SELECT up.user_id, up.expo_push_token, pe.event_type, pe.event_date
FROM user_preferences up
JOIN pickup_events pe ON pe.user_id = up.user_id
WHERE up.expo_push_token IS NOT NULL
  AND pe.event_date = (CURRENT_TIMESTAMP AT TIME ZONE up.timezone)::date + 1
  AND (
    (pe.event_type = 'garbage'    AND up.notifications_garbage = true)
    OR (pe.event_type = 'recycling' AND up.notifications_recycling = true)
    OR (pe.event_type = 'yard_waste' AND up.notifications_yard_waste = true)
  )
  AND (CURRENT_TIMESTAMP AT TIME ZONE up.timezone)::time
      BETWEEN up.notification_time AND up.notification_time + interval '30 minutes'
  AND NOT EXISTS (
    SELECT 1 FROM notification_log nl
    WHERE nl.user_id = up.user_id
      AND nl.event_type = pe.event_type
      AND (nl.sent_at AT TIME ZONE up.timezone)::date
          = (CURRENT_TIMESTAMP AT TIME ZONE up.timezone)::date
  )
```

Results batched and sent to Expo Push API. Results logged to `notification_log`.

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Address not found in Recollect | Show fallback screen with manual entry option |
| Multiple address matches | Show picker for user to confirm the correct address |
| Push notification delivery failure | Retry once; log failure; remove invalid tokens (Expo flags them) |
| Recollect API down during schedule refresh | Keep showing cached data; retry next day |
| User deletes app | Expo token becomes invalid; cron silently skips on next run |

---

## Out of Scope (v1)

- Per-type notification times (deferred to v2)
- Multiple saved addresses per user
- Canada / Australia coverage (Recollect supports both; add by expanding state→timezone mapping)
- Holiday schedule adjustments
- Native calendar integration

---

## Open Questions

- Recollect API pricing tier — confirm free tier limits vs. expected usage before launch
- Google OAuth setup — needs OAuth app credentials for both iOS and Android
