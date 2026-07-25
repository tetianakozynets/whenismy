# Change Password — Design Spec

**Date:** 2026-07-25
**Status:** Approved

---

## Overview

Add a Change Password flow to the Account tab. The user must supply their current password before setting a new one, providing a security re-authentication step.

---

## User Flow

1. User opens the **Account** tab
2. Taps **"Change password"** row (above "Sign out")
3. Navigated to `/change-password` screen
4. Fills in three fields: current password, new password, confirm new password
5. Taps **"Update password"**
6. On success: brief confirmation message shown, then `router.back()` to Account tab
7. On wrong current password: inline error "Current password is incorrect"
8. On mismatch: inline error "Passwords do not match"
9. On too short: inline error "Password must be at least 8 characters"

---

## Architecture

### `src/lib/auth.ts` — new `changePassword` function

```ts
changePassword(email: string, currentPassword: string, newPassword: string): Promise<{ error: string | null }>
```

- Step 1: Re-authenticate via `signIn(email, currentPassword)`
  - If this fails → return `{ error: 'Current password is incorrect' }`
- Step 2: Call `supabase.auth.updateUser({ password: newPassword })`
  - If this fails → return `{ error: err.message }`
- Step 3: Success → return `{ error: null }`

The `email` comes from `useAuth().user.email`.

### `app/change-password.tsx` — new screen

Fields:
- Current password (secureTextEntry)
- New password (secureTextEntry, min 8 chars)
- Confirm new password (secureTextEntry)

Validation (client-side, before submit):
- All fields non-empty
- New password ≥ 8 characters
- New password === confirm new password

On submit:
- Shows `ActivityIndicator` while loading
- Calls `changePassword(user.email, currentPassword, newPassword)`
- On `error: null` → show green "Password updated" message for 1.5s, then `router.back()`
- On error → show inline red error message

Layout follows the same pattern as `app/notifications.tsx`: `SafeAreaView` → `ScrollView` → back arrow, title, form fields, submit button.

### `app/(tabs)/account.tsx` — add row

Add a "Change password" `Pressable` row between the email card and the "Sign out" row. Navigates to `/change-password`.

---

## Error Handling

| Scenario | Message shown |
|---|---|
| Any field empty | "Please fill in all fields." |
| New password < 8 chars | "Password must be at least 8 characters." |
| Passwords don't match | "Passwords do not match." |
| Wrong current password | "Current password is incorrect." |
| Supabase update fails | Error message from Supabase |

---

## Testing

- `app/change-password.test.tsx` — unit tests covering: renders fields, shows error on mismatched passwords, shows error on short password, calls `changePassword` with correct args on valid submit, shows Supabase error on failure.
- `auth.ts` `changePassword` unit test: mocks `signIn` failure → returns correct error string; mocks `signIn` success + `updateUser` failure → returns Supabase error; mocks both success → returns `null`.

---

## Out of Scope

- Forgot password / reset via email (separate flow)
- Password strength meter
- Hiding/showing password toggle (deferred to v2)
