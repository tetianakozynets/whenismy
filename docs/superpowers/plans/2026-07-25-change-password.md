# Change Password Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Change Password screen accessible from the Account tab, requiring the user to confirm their current password before setting a new one.

**Architecture:** `changePassword` is added to `src/lib/auth.ts` — it re-authenticates via `signIn` to verify the current password, then calls `supabase.auth.updateUser`. A new `app/change-password.tsx` screen renders the three-field form. The Account tab gets a "Change password" row that navigates there.

**Tech Stack:** Expo Router, React Native, Supabase Auth, Jest + React Testing Library

---

### Task 1: Add `changePassword` to `src/lib/auth.ts`

**Files:**
- Modify: `src/lib/auth.ts`
- Modify: `src/lib/auth.test.ts`

- [ ] **Step 1: Add `updateUser` to the supabase mock in `auth.test.ts`**

Open `src/lib/auth.test.ts`. Replace the `jest.mock('./supabase', ...)` block with:

```typescript
jest.mock('./supabase', () => ({
  supabase: {
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      getSession: jest.fn(),
      updateUser: jest.fn(),
    },
  },
}))
```

- [ ] **Step 2: Write the three failing tests for `changePassword`**

Append to `src/lib/auth.test.ts` (after the existing `getSession` test):

```typescript
it('changePassword returns error when current password is wrong', async () => {
  mockAuth.signInWithPassword.mockResolvedValueOnce({ data: {}, error: { message: 'Invalid credentials' } } as any)
  const result = await changePassword('a@b.com', 'wrongpass', 'newpass12345678')
  expect(result).toEqual({ error: 'Current password is incorrect.' })
  expect(mockAuth.updateUser).not.toHaveBeenCalled()
})

it('changePassword returns supabase error when updateUser fails', async () => {
  mockAuth.signInWithPassword.mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null } as any)
  mockAuth.updateUser.mockResolvedValueOnce({ data: {}, error: { message: 'Password too weak' } } as any)
  const result = await changePassword('a@b.com', 'currentpass123', 'newpass12345678')
  expect(result).toEqual({ error: 'Password too weak' })
})

it('changePassword returns { error: null } on success', async () => {
  mockAuth.signInWithPassword.mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null } as any)
  mockAuth.updateUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null } as any)
  const result = await changePassword('a@b.com', 'currentpass123', 'newpass12345678')
  expect(result).toEqual({ error: null })
})
```

Also update the import line at the top of `auth.test.ts` to include `changePassword`:

```typescript
import { signUp, signIn, signOut, getSession, changePassword } from './auth'
```

- [ ] **Step 3: Run the tests — verify they fail**

```bash
npx jest --testPathPattern="src/lib/auth.test" --no-coverage
```

Expected: 3 failures with "changePassword is not a function" or similar.

- [ ] **Step 4: Implement `changePassword` in `src/lib/auth.ts`**

Append to `src/lib/auth.ts`:

```typescript
export async function changePassword(
  email: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ error: string | null }> {
  const { error: signInError } = await signIn(email, currentPassword)
  if (signInError) return { error: 'Current password is incorrect.' }
  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
  if (updateError) return { error: updateError.message }
  return { error: null }
}
```

- [ ] **Step 5: Run the tests — verify they pass**

```bash
npx jest --testPathPattern="src/lib/auth.test" --no-coverage
```

Expected: all tests PASS (the 3 new ones plus the 4 existing ones — 7 total).

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth.ts src/lib/auth.test.ts
git commit -m "feat: add changePassword to auth lib"
```

---

### Task 2: Build `app/change-password.tsx` screen

**Files:**
- Create: `app/change-password.tsx`
- Create: `app/change-password.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `app/change-password.test.tsx`:

```typescript
import React from 'react'
import { render, fireEvent, waitFor, act } from '@testing-library/react-native'
import ChangePasswordScreen from './change-password'
import * as auth from '../src/lib/auth'

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
}))

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: any) => children,
}))

jest.mock('../src/lib/auth-context', () => ({
  useAuth: jest.fn(() => ({ user: { id: 'u1', email: 'test@example.com' } })),
}))

jest.mock('../src/lib/auth', () => ({
  changePassword: jest.fn(),
}))

beforeEach(() => {
  jest.clearAllMocks()
  jest.useRealTimers()
  const { useAuth } = require('../src/lib/auth-context')
  useAuth.mockReturnValue({ user: { id: 'u1', email: 'test@example.com' } })
})

describe('ChangePasswordScreen', () => {
  it('renders nothing when user is null', () => {
    const { useAuth } = require('../src/lib/auth-context')
    useAuth.mockReturnValue({ user: null })
    const { toJSON } = render(<ChangePasswordScreen />)
    expect(toJSON()).toBeNull()
  })

  it('renders three password inputs and a submit button', () => {
    const { getByTestId } = render(<ChangePasswordScreen />)
    expect(getByTestId('input-current-password')).toBeTruthy()
    expect(getByTestId('input-new-password')).toBeTruthy()
    expect(getByTestId('input-confirm-password')).toBeTruthy()
    expect(getByTestId('submit-button')).toBeTruthy()
  })

  it('shows error when any field is empty', async () => {
    const { getByTestId, findByTestId } = render(<ChangePasswordScreen />)
    fireEvent.press(getByTestId('submit-button'))
    expect(await findByTestId('error-message')).toHaveTextContent('Please fill in all fields.')
    expect(auth.changePassword).not.toHaveBeenCalled()
  })

  it('shows error when new password is less than 8 characters', async () => {
    const { getByTestId, findByTestId } = render(<ChangePasswordScreen />)
    fireEvent.changeText(getByTestId('input-current-password'), 'currentpass123')
    fireEvent.changeText(getByTestId('input-new-password'), 'short')
    fireEvent.changeText(getByTestId('input-confirm-password'), 'short')
    fireEvent.press(getByTestId('submit-button'))
    expect(await findByTestId('error-message')).toHaveTextContent('Password must be at least 8 characters.')
    expect(auth.changePassword).not.toHaveBeenCalled()
  })

  it('shows error when passwords do not match', async () => {
    const { getByTestId, findByTestId } = render(<ChangePasswordScreen />)
    fireEvent.changeText(getByTestId('input-current-password'), 'currentpass123')
    fireEvent.changeText(getByTestId('input-new-password'), 'newpass12345678')
    fireEvent.changeText(getByTestId('input-confirm-password'), 'differentpass123')
    fireEvent.press(getByTestId('submit-button'))
    expect(await findByTestId('error-message')).toHaveTextContent('Passwords do not match.')
    expect(auth.changePassword).not.toHaveBeenCalled()
  })

  it('calls changePassword with correct args on valid submit', async () => {
    ;(auth.changePassword as jest.Mock).mockResolvedValue({ error: null })
    jest.useFakeTimers()
    const { getByTestId } = render(<ChangePasswordScreen />)
    fireEvent.changeText(getByTestId('input-current-password'), 'currentpass123')
    fireEvent.changeText(getByTestId('input-new-password'), 'newpass12345678')
    fireEvent.changeText(getByTestId('input-confirm-password'), 'newpass12345678')
    await act(async () => {
      fireEvent.press(getByTestId('submit-button'))
    })
    expect(auth.changePassword).toHaveBeenCalledWith(
      'test@example.com', 'currentpass123', 'newpass12345678'
    )
  })

  it('shows success message and navigates back after 1.5s', async () => {
    ;(auth.changePassword as jest.Mock).mockResolvedValue({ error: null })
    jest.useFakeTimers()
    const { getByTestId, findByTestId } = render(<ChangePasswordScreen />)
    fireEvent.changeText(getByTestId('input-current-password'), 'currentpass123')
    fireEvent.changeText(getByTestId('input-new-password'), 'newpass12345678')
    fireEvent.changeText(getByTestId('input-confirm-password'), 'newpass12345678')
    await act(async () => {
      fireEvent.press(getByTestId('submit-button'))
    })
    expect(await findByTestId('success-message')).toHaveTextContent('Password updated')
    act(() => jest.advanceTimersByTime(1500))
    const { router } = require('expo-router')
    expect(router.back).toHaveBeenCalledTimes(1)
  })

  it('shows error message returned by changePassword', async () => {
    ;(auth.changePassword as jest.Mock).mockResolvedValue({ error: 'Current password is incorrect.' })
    const { getByTestId, findByTestId } = render(<ChangePasswordScreen />)
    fireEvent.changeText(getByTestId('input-current-password'), 'wrongpass')
    fireEvent.changeText(getByTestId('input-new-password'), 'newpass12345678')
    fireEvent.changeText(getByTestId('input-confirm-password'), 'newpass12345678')
    await act(async () => {
      fireEvent.press(getByTestId('submit-button'))
    })
    expect(await findByTestId('error-message')).toHaveTextContent('Current password is incorrect.')
  })

  it('calls router.back() when the back link is pressed', () => {
    const { getByText } = render(<ChangePasswordScreen />)
    fireEvent.press(getByText('← Back'))
    const { router } = require('expo-router')
    expect(router.back).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run the tests — verify they fail**

```bash
npx jest --testPathPattern="app/change-password.test" --no-coverage
```

Expected: failures because `./change-password` module does not exist yet.

- [ ] **Step 3: Implement `app/change-password.tsx`**

Create `app/change-password.tsx`:

```typescript
import React, { useState } from 'react'
import {
  View, Text, TextInput, Pressable, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useAuth } from '../src/lib/auth-context'
import { changePassword } from '../src/lib/auth'
import { colors, spacing, radius } from '../src/constants/theme'

export default function ChangePasswordScreen() {
  const { user } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  if (!user) return null

  async function handleSubmit() {
    setError(null)
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Please fill in all fields.')
      return
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    const result = await changePassword(user!.email!, currentPassword, newPassword)
    setLoading(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setSuccess(true)
    setTimeout(() => router.back(), 1500)
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container}>
          <Pressable onPress={() => router.back()} style={styles.backRow}>
            <Text style={styles.backLink}>← Back</Text>
          </Pressable>
          <Text style={styles.title}>Change password</Text>

          <TextInput
            style={styles.input}
            placeholder="Current password"
            placeholderTextColor={colors.textSecondary}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            returnKeyType="next"
            testID="input-current-password"
          />
          <TextInput
            style={styles.input}
            placeholder="New password (min 8 characters)"
            placeholderTextColor={colors.textSecondary}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            returnKeyType="next"
            testID="input-new-password"
          />
          <TextInput
            style={styles.input}
            placeholder="Confirm new password"
            placeholderTextColor={colors.textSecondary}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
            testID="input-confirm-password"
          />

          {error ? <Text style={styles.error} testID="error-message">{error}</Text> : null}
          {success ? <Text style={styles.success} testID="success-message">Password updated</Text> : null}

          <Pressable
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            testID="submit-button"
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>Update password</Text>
            }
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  container: { padding: spacing.lg, gap: spacing.md },
  backRow: { paddingBottom: spacing.sm },
  backLink: { color: colors.primary, fontSize: 15 },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    fontSize: 16,
    backgroundColor: colors.card,
    color: colors.text,
  },
  error: { color: colors.error, fontSize: 14 },
  success: { color: '#10B981', fontSize: 14 },
  button: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
```

- [ ] **Step 4: Run the tests — verify they pass**

```bash
npx jest --testPathPattern="app/change-password.test" --no-coverage
```

Expected: all 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/change-password.tsx app/change-password.test.tsx
git commit -m "feat: add change-password screen"
```

---

### Task 3: Add "Change password" row to Account tab

**Files:**
- Modify: `app/(tabs)/account.tsx`
- Modify: `app/(tabs)/account.test.tsx`

- [ ] **Step 1: Write the failing test**

Open `app/(tabs)/account.test.tsx`. Add this test inside the `describe('AccountTab', ...)` block, after the existing "navigates to /(tabs)/search" test:

```typescript
it('navigates to /change-password when Change password is pressed', async () => {
  const { getByText } = await renderLoaded(basePrefs)
  fireEvent.press(getByText('Change password'))
  const { router } = require('expo-router')
  expect(router.push).toHaveBeenCalledWith('/change-password')
})
```

- [ ] **Step 2: Run the test — verify it fails**

```bash
npx jest --testPathPattern="app/.*tabs.*account.test" --no-coverage
```

Expected: 1 new failure — "Unable to find an element with text: Change password".

- [ ] **Step 3: Add the "Change password" row to `app/(tabs)/account.tsx`**

In `app/(tabs)/account.tsx`, locate the `<Pressable style={styles.row} onPress={handleSignOut}` block. Insert the following **before** it (between the email card and the "Sign out" row):

```typescript
<Pressable
  style={styles.row}
  onPress={() => router.push('/change-password')}
  accessibilityRole="button"
>
  <Text style={styles.rowText}>Change password</Text>
</Pressable>
```

- [ ] **Step 4: Run the tests — verify they all pass**

```bash
npx jest --testPathPattern="app/.*tabs.*account.test" --no-coverage
```

Expected: all tests PASS (the new one plus all 13 existing ones — 14 total).

- [ ] **Step 5: Run the full test suite to check for regressions**

```bash
npx jest --no-coverage
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add "app/(tabs)/account.tsx" "app/(tabs)/account.test.tsx"
git commit -m "feat: add change password row to account tab"
```
