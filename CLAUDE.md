# whenIsMy — Claude Code Guide

## What this project is

A web + mobile app (React Native / Expo) where users enter a US address and see upcoming garbage and recycling pickup days. Signed-in users can enable push notification reminders the night before each pickup.

## Repository layout

```
supabase/                    Backend (Supabase)
  migrations/                Postgres migrations (apply in numeric order)
  functions/                 Deno Edge Functions
    _shared/                 Shared utilities (recollect, push, rate-limit, tz)
    lookup-schedule/         Address lookup + 24h cache + rate limiting
    refresh-schedules/       Weekly staggered schedule refresh
    send-notifications/      Nightly push notification dispatch
    recompute-notify-at/     Daily notify_at recompute
    coverage-request/        Coverage request email
  tests/                     pgTAP tests (schema + RLS)
docs/
  superpowers/
    specs/                   Design spec (source of truth)
    plans/                   Implementation plans
```

The Expo app (Plans 2 & 3) lives in `src/` — not yet created.

## Tech stack

| Layer | Technology |
|---|---|
| Mobile + Web | Expo (React Native) — iOS, Android, Web |
| Backend | Supabase (Postgres 15 + Auth + Edge Functions + pg_cron) |
| Schedule data | Recollect/Wasteline API (commercial key required) |
| Push notifications | Expo Push Notification Service |
| Timezone lookup | `tz-lookup` npm package (lat/lng → IANA tz) |

## Key design decisions

- **No anonymous server-side state** — unauthenticated users look up schedules live; nothing saved. Notifications require an account.
- **`push_tokens` is a separate table** — never exposed via `SELECT *` on `user_preferences`.
- **`notify_at` is pre-computed** — a `timestamptz` column updated daily by pg_cron, so the notification cron query hits an index rather than doing per-row timezone arithmetic.
- **Staggered schedule refresh** — `slotForUser(uuid) % 336` spreads weekly Recollect API calls across 336 half-hour slots. No Sunday thundering herd.
- **Dedup is app-layer only** — timezone-aware local-day dedup is enforced in `send-notifications/index.ts`, not via a DB unique index (UTC truncation would break users near midnight).
- **Manual entry fallback** — when Recollect doesn't cover an address, users enter recurring pickup days (weekly/bi-weekly with anchor date). Same `pickup_events` table, `source = 'manual'`.

## Local development

```bash
# Prerequisites: Docker running, Node 18+, Deno 1.38+

# Start local Supabase (first run pulls images, ~3 min)
npx supabase start

# Apply migrations + run pgTAP tests
npx supabase db reset
npx supabase test db

# Serve an Edge Function locally
npx supabase functions serve lookup-schedule --env-file .env.local

# Run Deno unit tests
deno test --allow-env --no-check supabase/functions/lookup-schedule/index.test.ts
```

Copy `.env.example` to `.env.local` and fill in values before running Edge Functions locally.

## Worktrees

Feature branches use `.worktrees/` (gitignored). Create with:

```bash
git worktree add .worktrees/<branch-name> -b feature/<branch-name>
```

## Plans

| Plan | File | Status |
|---|---|---|
| 1 — Backend & Infrastructure | `docs/superpowers/plans/2026-04-27-backend-infrastructure.md` | ✅ merged |
| 2 — Expo App: Core & Anonymous Flow | `docs/superpowers/plans/2026-04-27-expo-core.md` | ✅ merged |
| 2.5 — Provider Architecture (NYC DSNY + iCal) | `docs/superpowers/plans/2026-04-29-provider-architecture.md` | ✅ merged |
| 3 — Expo App: Auth, Notifications & Manual Entry | TBD | pending |

## Supabase deployment notes

Before deploying to production:

1. The cron jobs (`send-notifications`, `refresh-schedules`, `recompute-notify-at`) authenticate to
   Edge Functions via a key stored in **Supabase Vault**, not a custom `app.*` GUC parameter —
   `ALTER DATABASE postgres SET "app.xxx"` fails with `42501 permission denied` on hosted Supabase;
   custom `app.*` params aren't settable there at all. See migration `20260728000010_cron_vault_auth.sql`.
   One-time setup, run by hand in the SQL Editor (never commit the real value to a migration):
   ```sql
   select vault.create_secret('<your sb_secret_... key>', 'cron_service_role_key');
   ```
2. Set Edge Function secrets: `npx supabase secrets set RECOLLECT_API_KEY=... SUPPORT_EMAIL=...`
3. `coverage-request` email requires Pro plan SMTP or swap to Resend/SendGrid

## Spec

Full design spec: `docs/superpowers/specs/2026-04-27-whenismy-design.md`
