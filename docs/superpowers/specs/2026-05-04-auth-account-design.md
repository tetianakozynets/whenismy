# WIM — Auth & Account Screen Design

## Summary of decisions

| Screen / Feature | Decision |
|---|---|
| Sign-in layout | Hero + form panel (Option B) |
| Auth method | Email + password only (no social auth for now) |
| Account screen | Quick-action tiles (Option C) |
| Address save | "Save as my address" button on schedule screen |
| Signed-in home | Auto-load saved address on Schedule tab |
| Bottom tabs | 3 tabs, filled-red-active style (Option A) |
| Empty schedule state | Prompt to search, land on Schedule tab always |

---

## Navigation

**Anonymous users** — no tab bar. Same flow as today:
- Home (`/`) → address form → schedule results

**Signed-in users** — bottom tab bar always visible with 3 tabs:
1. **Schedule** (`📅`) — saved address schedule, auto-loaded
2. **Search** (`🔍`) — address search form (same as current home)
3. **Account** (`👤`) — profile, notifications, sign out

The tab bar uses `@expo/vector-icons` Ionicons:
- Active tab: filled icon + label, both in `colors.primary` (`#e94560`)
- Inactive tab: outline icon + label in `colors.textSecondary` (`#888888`)
- Background: `colors.card` (`#1a1a2e`), top border `colors.border` (`#2a2a4a`)

---

## Sign-in / Sign-up screen

**Layout — hero + form panel:**

```
┌────────────────────────┐
│                        │  ← top half: hero (gradient dark bg)
│        WIM             │
│    When Is My          │
│                        │
│  [🗑️ Garbage] [♻️ Recycling] [🍂 Yard]  │  ← pickup type pills
│                        │
├────────────────────────┤
│  Email ____________    │  ← bottom panel: card bg
│  Password __________   │
│  [Create account]      │  ← primary red button
│  Already have one? →   │  ← toggle mode link
└────────────────────────┘
```

- Hero: `colors.background` → `colors.card` gradient, WIM title in `#e94560`, subtitle in gray
- Pickup type pills: small rounded chips, `colors.card` bg with `colors.border` border
- Form panel: `colors.card` bg, separated by a subtle top border
- Toggle link switches between "Sign up" and "Sign in" modes on the same screen
- Password minimum: 12 characters (already implemented)
- After sign-up: show info message "Check your email to confirm your account, then sign in." and switch to sign-in mode
- After sign-in: navigate to Schedule tab

---

## Schedule tab — signed-in

**With saved address:** auto-loads the saved address schedule immediately. No search form. The existing `ScheduleContent` component renders as-is.

**Empty state (no address saved yet):**
```
┌────────────────────────┐
│  📅                    │
│  No address saved yet  │
│                        │
│  Search for your       │
│  pickup schedule and   │
│  save it to see it     │
│  here every time.      │
│                        │
│  [Go to Search →]      │  ← switches to Search tab
└────────────────────────┘
```
Centered, `colors.textSecondary` text, primary red button navigates to Search tab programmatically.

**"Save as my address" banner** — shown on the schedule screen only for signed-in users when the displayed address is NOT their saved one:

```
┌─ 📍 Save as my address ──────────────────┐
│  Get reminders for this address     [Save] │
└────────────────────────────────────────────┘
```
- Bordered card, `colors.card` bg, `colors.primary` border
- After saving: banner updates to `✓ Address saved — set up reminders →` (navigates to Notifications screen)
- Banner is hidden if this address is already saved

---

## Account screen (tab)

Tiles layout, no avatar/photo:

```
┌────────────────────────┐
│  Account               │
│                        │
│  ┌──────────┐ ┌──────────┐
│  │ 🔔       │ │ 📍       │
│  │ Reminders│ │ Address  │
│  │Garbage·  │ │Mahwah, NJ│
│  │Recycling │ │          │
│  └──────────┘ └──────────┘
│                        │
│  ┌──────────────────┐  │
│  │ Signed in as     │  │
│  │ user@email.com   │  │
│  └──────────────────┘  │
│                        │
│  Sign out              │
│  Delete account        │  ← red text
└────────────────────────┘
```

- **Reminders tile** — taps to the Notifications screen. Shows which types are active (e.g. "Garbage · Recycling") or "Off" if none enabled.
- **Address tile** — taps to the Search tab so user can look up a new address and save it. Shows saved city + state.
- **Signed in as** card — email display only, no edit.
- **Sign out** — signs out and navigates to anonymous home (`/`).
- **Delete account** — confirmation alert, then sign out and navigate to `/`.

---

## Notifications screen

Existing layout kept — no visual redesign needed:
- Toggle rows per supported pickup type (Garbage, Recycling, Yard Waste)
- Only shows types supported by the user's saved address provider
- Time picker: chip row (6 PM – 10 PM)
- Save button saves preferences to Supabase

---

## Address save flow — full sequence

1. **Search tab** (or anonymous home) → user types address → sees schedule
2. If signed in and address ≠ saved address → **"Save as my address"** banner appears below the next-pickup card
3. User taps Save → address written to `user_preferences`, events to `pickup_events`
4. Banner updates to **"✓ Address saved — set up reminders →"**
5. **Schedule tab** now auto-loads this address on next open
6. **Account → Address tile** → navigates to Search tab to re-search and save a different address

---

## Implementation notes

- Use `expo-router` tab layout (`app/(tabs)/`) for the signed-in navigation
- Anonymous users use the existing `app/index.tsx` and `app/schedule.tsx` routes
- Auth state from `useAuth()` determines which layout to render in `app/_layout.tsx`
- Bottom tab bar is a custom component (not Expo Router's default tab bar) to match the dark theme
- `@expo/vector-icons` Ionicons: `calendar` / `calendar-outline`, `search` / `search-outline`, `person` / `person-outline`
