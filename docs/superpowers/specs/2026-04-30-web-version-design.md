# Web Version — Design Spec

**Date:** 2026-04-30
**Status:** Approved

---

## Overview

Polish the existing Expo web output into a proper desktop web experience. The app already targets `"platforms": ["ios", "android", "web"]` in `app.json`, but the current implementation renders a mobile-only layout in the browser with incorrect colors (light gray + blue instead of the original dark navy + pink design).

This spec covers three changes:

1. Fix the color system to match the original approved design
2. Add emoji icons to pickup type badges
3. Add a responsive split-panel layout for wide screens (≥ 768px)

No new backend work is required.

---

## 1. Color System

Update `src/constants/theme.ts` to the dark theme from the original design:

| Token | Old | New |
|---|---|---|
| `background` | `#F9FAFB` | `#0d0d1a` |
| `card` | `#FFFFFF` | `#1a1a2e` |
| `primary` | `#2563EB` | `#e94560` |
| `text` | `#111827` | `#FFFFFF` |
| `textSecondary` | `#6B7280` | `#888888` |
| `border` | `#E5E7EB` | `#2a2a4a` |

Event type colors are unchanged — they are readable on the dark background:

| Token | Value |
|---|---|
| `garbage` | `#6B7280` |
| `recycling` | `#10B981` |
| `yard_waste` | `#84CC16` |
| `error` | `#EF4444` |

The `NextPickupCard` uses a `linear-gradient(135deg, #e94560, #c0392b)` background (pink → deep red) instead of a solid card color. This is the only component with a gradient; all other cards use `colors.card`.

---

## 2. Emoji Icon System

### New file: `src/lib/event-icons.ts`

Maps event type strings to emoji characters:

```
garbage    → 🗑️
recycling  → ♻️
yard_waste → 🌿
bulk_waste → 📦
(fallback) → 🚛
```

Exported as a plain lookup function: `eventTypeIcon(eventType: string): string`.

### `EventTypeBadge` update

The badge renders `{emoji} {label}` inside the colored pill. Emoji sits to the left of the label text, same font size as the label.

### `NextPickupCard` update

Shows the emoji at a larger size (28px) above the event type label, above the date. The card background becomes the pink gradient.

---

## 3. Split Panel Layout

### Breakpoint

`SPLIT_BREAKPOINT = 768` (px). Defined as a constant in `src/constants/theme.ts` alongside the color tokens.

### Hook: `src/lib/use-split-layout.ts`

```ts
import { useWindowDimensions } from 'react-native'
import { SPLIT_BREAKPOINT } from '../constants/theme'

export function useSplitLayout(): boolean {
  const { width } = useWindowDimensions()
  return width >= SPLIT_BREAKPOINT
}
```

Works on web (window resize events) and native (orientation changes) via React Native's built-in `useWindowDimensions`.

### Component: `src/components/SplitLayout.tsx`

Accepts two props: `form` (ReactNode) and `panel` (ReactNode).

- **Narrow (< 768px):** renders nothing — the existing screen-based navigation handles layout. `SplitLayout` is not used on narrow viewports.
- **Wide (≥ 768px):** renders a full-height two-column row:
  - Left column: 320px fixed width, dark background, contains `form`
  - Divider: 1px `colors.border`
  - Right column: `flex: 1`, dark background, contains `panel`

### Screen refactoring

#### `app/index.tsx`

Extract the address form + match picker into a self-contained `<HomeForm>` component (can live in `src/components/HomeForm.tsx` or inline). On wide screens, `index.tsx` renders `<SplitLayout form={<HomeForm />} panel={<SchedulePanel />} />`. On narrow screens it renders `<HomeForm />` alone (same as today).

`SchedulePanel` reads from `scheduleStore` and renders the schedule results or a placeholder when no result is loaded:

```
Placeholder (no result yet):
  Dark background, centered text:
  "Enter your address on the left to see your schedule"
```

#### `app/schedule.tsx`

On wide screens (`useSplitLayout() === true`), `schedule.tsx` redirects to `/` — the split panel on the home screen already shows the result in the right panel, so a separate `/schedule` route is redundant on desktop.

On narrow screens, `schedule.tsx` behaves exactly as today.

### Navigation behavior

| Viewport | After successful lookup | "← Change address" |
|---|---|---|
| Narrow (< 768px) | `router.push('/schedule')` as today | `router.back()` to home |
| Wide (≥ 768px) | Right panel updates in place, no navigation | Form clears, right panel returns to placeholder |

### Empty right panel

Before a lookup, the right panel shows a centered placeholder on the dark background:

> "Enter your address on the left to see your schedule"

Text style: `colors.textSecondary`, 14px, centered.

---

## Files Changed

| File | Change |
|---|---|
| `src/constants/theme.ts` | Update color tokens, add `SPLIT_BREAKPOINT` |
| `src/lib/event-icons.ts` | New — emoji lookup |
| `src/lib/use-split-layout.ts` | New — responsive hook |
| `src/components/EventTypeBadge.tsx` | Add emoji to badge |
| `src/components/NextPickupCard.tsx` | Add large emoji, pink gradient background |
| `src/components/SplitLayout.tsx` | New — split panel shell |
| `src/components/SchedulePanel.tsx` | New — schedule results or placeholder, used as right panel |
| `app/index.tsx` | Integrate `SplitLayout` on wide screens |
| `app/schedule.tsx` | Redirect to `/` on wide screens |

All other screens (`address-not-found.tsx`, `calendar-url.tsx`) use the updated theme colors automatically — no structural changes needed.

---

## Out of Scope

- SEO / meta tags (no server-side rendering changes)
- Shareable URLs / address in query params
- Animations or transitions between states
- Web-specific keyboard shortcuts
