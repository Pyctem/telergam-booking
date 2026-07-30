# Telegram UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bare-HTML client-facing screens (services list, slot selection, confirmation, my bookings) with `@telegram-apps/telegram-ui` components, matching Telegram's native visual language and the app's existing light/dark theme adaptation.

**Architecture:** Wrap the app in `telegram-ui`'s `<AppRoot>` with an explicit, reactive `appearance` prop (driven by the already-integrated `isDark` theme signal — `AppRoot`'s own auto-detection only reads `prefers-color-scheme` once at mount, not real Telegram theme). Platform (`ios`/`base`) is left to `AppRoot`'s built-in auto-detection, which correctly reads `window.Telegram.WebApp.platform` — verified by reading the installed package's source, not assumed. Existing hooks (`useMainButton`, `useBackButton`, `useTelegramTheme`, `useBusinessSettings`) and the entire API layer are unchanged. A new pure function generates the calendar grid for date selection; `telegram-ui` has no built-in calendar/date-picker component (confirmed by enumerating the installed package's component list).

**Tech Stack adds:** `@telegram-apps/telegram-ui` (verified against version `2.1.13` during planning — pin whatever is actually latest-stable at implementation time).

## Global Constraints

- `telegram-ui` component props referenced in this plan were verified by reading the installed package's `.d.ts` files directly (not guessed from memory or docs). Any prop signature not explicitly shown in a task's code (e.g. exact CSS class names, undocumented behavior) must be checked against `node_modules/@telegram-apps/telegram-ui/dist/dts/` before use, following the same discipline used earlier in this project for the Telegram SDK.
- No business logic, API calls, or data-fetching hooks change in this plan — only JSX/markup inside the four client-facing page components, plus the new `AppRoot`/appearance wiring in `App.tsx`/`main.tsx`.
- The admin panel (`AdminLayout`, `AdminBookings`, `AdminServices`) is explicitly out of scope — do not touch it.
- `MainButton`/`BackButton` (native Telegram chrome, via `useMainButton`/`useBackButton`) are not replaced by `telegram-ui` components — they stay exactly as implemented.
- Existing tests' API/hook mocks (`vi.mock('../../src/api/...')`, `vi.mock('@telegram-apps/sdk-react', ...)`) must keep working — only update assertions that depend on markup structure, not the mocking strategy itself.
- TypeScript strict mode. `MemoryRouter` in tests must keep `future={{ v7_startTransition: true, v7_relativeSplatPath: true }}`.
- Test output must stay pristine (no console warnings/errors beyond what's already expected and asserted-on).

---

## File Structure Overview

```
frontend/
├── src/
│   ├── main.tsx                         # modified: telegram-ui CSS import, sync theme mount
│   ├── App.tsx                          # modified: AppRoot wrapper, appearance hook
│   ├── lib/
│   │   ├── telegramTheme.ts             # new: ensureThemeParamsMounted (extracted from useTelegramTheme)
│   │   └── calendarGrid.ts              # new: pure calendar-week generator
│   ├── hooks/
│   │   ├── useTelegramTheme.ts          # modified: use ensureThemeParamsMounted
│   │   └── useTelegramAppearance.ts     # new: reactive light/dark signal -> AppRoot appearance
│   └── pages/
│       ├── ServicesList/ServicesList.tsx    # modified: telegram-ui components
│       ├── BookingFlow/SelectSlot.tsx       # modified: telegram-ui components + calendar grid
│       ├── BookingFlow/Confirm.tsx          # modified: telegram-ui components
│       └── MyBookings/MyBookings.tsx        # modified: telegram-ui components
├── tests/
│   ├── lib/calendarGrid.test.ts         # new
│   ├── hooks/useTelegramAppearance.test.ts  # new
│   ├── hooks/useTelegramTheme.test.tsx  # modified: import path only, same mocking
│   ├── pages/ServicesList.test.tsx      # modified: selector updates only
│   ├── pages/SelectSlot.test.tsx        # modified: selector updates only
│   ├── pages/Confirm.test.tsx           # modified: selector updates only
│   └── pages/MyBookings.test.tsx        # modified: selector updates only
```

---

## Task 1: Install telegram-ui, wire AppRoot with reactive appearance

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/src/lib/telegramTheme.ts`
- Modify: `frontend/src/hooks/useTelegramTheme.ts`
- Create: `frontend/src/hooks/useTelegramAppearance.ts`
- Modify: `frontend/src/main.tsx`
- Modify: `frontend/src/App.tsx`
- Test: `frontend/tests/hooks/useTelegramAppearance.test.ts`

**Interfaces:**
- Consumes: `mountThemeParamsSync`, `isThemeParamsMounted`, `bindThemeParamsCssVars`, `useSignal`, `themeParams` from `@telegram-apps/sdk-react` (all confirmed real exports, already used elsewhere in this codebase per Task 12 of the original plan).
- Produces: `ensureThemeParamsMounted(): void` from `frontend/src/lib/telegramTheme.ts`, consumed by both `main.tsx` and `useTelegramTheme.ts`. `useTelegramAppearance(): 'light' | 'dark'` from `frontend/src/hooks/useTelegramAppearance.ts`, consumed by `App.tsx`.

- [ ] **Step 1: Install the dependency**

```bash
cd frontend
npm install @telegram-apps/telegram-ui
```

- [ ] **Step 2: Verify the installed package's key APIs before writing code**

```bash
find node_modules/@telegram-apps/telegram-ui/dist/dts/components/Service/AppRoot -iname "*.d.ts" | xargs cat
find node_modules/@telegram-apps/telegram-ui/dist/dts/components/Blocks -iname "Cell.d.ts" | xargs cat
```

Confirm `AppRoot`'s `appearance` prop type is `'light' | 'dark' | undefined` (matching this task's code below) and that `CellProps` still has `children`, `subtitle`, `Component` as described in this plan. If the installed version differs from what's written here, adjust the code in this and later tasks to match — do not silently force the plan's assumed shape onto a different real API.

- [ ] **Step 3: Write the failing test — `frontend/tests/hooks/useTelegramAppearance.test.ts`**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTelegramAppearance } from '../../src/hooks/useTelegramAppearance';

vi.mock('@telegram-apps/sdk-react', () => ({
  useSignal: vi.fn(),
  themeParams: { isDark: vi.fn() },
}));

describe('useTelegramAppearance', () => {
  it('returns "dark" when the isDark signal is true', async () => {
    const { useSignal } = await import('@telegram-apps/sdk-react');
    (useSignal as ReturnType<typeof vi.fn>).mockReturnValue(true);

    const { result } = renderHook(() => useTelegramAppearance());

    expect(result.current).toBe('dark');
  });

  it('returns "light" when the isDark signal is false', async () => {
    const { useSignal } = await import('@telegram-apps/sdk-react');
    (useSignal as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const { result } = renderHook(() => useTelegramAppearance());

    expect(result.current).toBe('light');
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

```bash
npm test -- tests/hooks/useTelegramAppearance.test.ts
```
Expected: FAIL with "Cannot find module '../../src/hooks/useTelegramAppearance'".

- [ ] **Step 5: Create `frontend/src/lib/telegramTheme.ts`**

```typescript
import { mountThemeParamsSync, isThemeParamsMounted } from '@telegram-apps/sdk-react';

// Guarded, idempotent mount — safe to call multiple times (e.g. once
// synchronously in main.tsx before the first render, and again from
// useTelegramTheme's effect). Outside a real Telegram client,
// mountThemeParamsSync.isAvailable() is false and this is a no-op.
export function ensureThemeParamsMounted(): void {
  if (mountThemeParamsSync.isAvailable() && !isThemeParamsMounted()) {
    mountThemeParamsSync();
  }
}
```

- [ ] **Step 6: Modify `frontend/src/hooks/useTelegramTheme.ts`** to use the extracted helper (behavior unchanged, just DRY):

```typescript
import { useEffect } from 'react';
import { bindThemeParamsCssVars } from '@telegram-apps/sdk-react';
import { ensureThemeParamsMounted } from '../lib/telegramTheme';

export function useTelegramTheme(): void {
  useEffect(() => {
    ensureThemeParamsMounted();
    if (bindThemeParamsCssVars.isAvailable()) {
      return bindThemeParamsCssVars();
    }
  }, []);
}
```

- [ ] **Step 7: Create `frontend/src/hooks/useTelegramAppearance.ts`**

```typescript
import { useSignal, themeParams } from '@telegram-apps/sdk-react';

export function useTelegramAppearance(): 'light' | 'dark' {
  const isDark = useSignal(themeParams.isDark);
  return isDark ? 'dark' : 'light';
}
```

- [ ] **Step 8: Run the test to verify it passes**

```bash
npm test -- tests/hooks/useTelegramAppearance.test.ts
```
Expected: PASS (2 tests).

- [ ] **Step 9: Run `frontend/tests/hooks/useTelegramTheme.test.tsx` to confirm the refactor in Step 6 didn't break it**

```bash
npm test -- tests/hooks/useTelegramTheme.test.tsx
```
Expected: PASS, unchanged (the test mocks `@telegram-apps/sdk-react` at the module level, which `ensureThemeParamsMounted` also imports from — no test changes needed). If it fails, read the actual failure before changing the test — the mocking strategy should still be valid.

- [ ] **Step 10: Modify `frontend/src/main.tsx`**

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { init } from '@telegram-apps/sdk-react';
import { App } from './App';
import './theme.css';
import '@telegram-apps/telegram-ui/dist/styles.css';
import { ensureThemeParamsMounted } from './lib/telegramTheme';

try {
  init();
} catch (err) {
  // Outside a real Telegram client (e.g. a plain browser during local dev),
  // init() throws LaunchParamsRetrieveError synchronously — it can't find
  // launch params in the URL, performance entries, or localStorage. Every
  // other Telegram SDK call in this app is already guarded by .isAvailable()
  // checks and degrades gracefully on its own; without this try/catch, the
  // uncaught throw here would stop this module before React ever mounts,
  // leaving a blank page.
  console.warn('Telegram SDK init() failed — running outside Telegram?', err);
}

// Mount theme params synchronously, before the first render, so AppRoot's
// `appearance` prop (driven by the isDark signal in App.tsx) reflects the
// real Telegram theme from the first paint instead of briefly flashing the
// light-mode default. useTelegramTheme's effect calls this again — the
// isMounted guard inside makes that a no-op, not a double-mount.
ensureThemeParamsMounted();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 11: Modify `frontend/src/App.tsx`**

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppRoot } from '@telegram-apps/telegram-ui';
import { ServicesList } from './pages/ServicesList/ServicesList';
import { SelectSlot } from './pages/BookingFlow/SelectSlot';
import { Confirm } from './pages/BookingFlow/Confirm';
import { MyBookings } from './pages/MyBookings/MyBookings';
import { AdminLayout } from './pages/Admin/AdminLayout';
import { useTelegramTheme } from './hooks/useTelegramTheme';
import { useTelegramAppearance } from './hooks/useTelegramAppearance';

const queryClient = new QueryClient();

export function App() {
  useTelegramTheme();
  const appearance = useTelegramAppearance();

  return (
    <AppRoot appearance={appearance}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/" element={<ServicesList />} />
            <Route path="/booking/:serviceId" element={<SelectSlot />} />
            <Route path="/booking/:serviceId/confirm" element={<Confirm />} />
            <Route path="/my-bookings" element={<MyBookings />} />
            <Route path="/admin" element={<AdminLayout />} />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </AppRoot>
  );
}
```

- [ ] **Step 12: Run the full test suite and typecheck**

```bash
npm test
npx tsc -b
```
Expected: all tests PASS, `tsc -b` clean. `AdminLayout` and its sub-pages are unstyled and untouched — they'll now render inside `AppRoot`'s context, which should be harmless (telegram-ui context providers fall back to auto-detected values when no explicit prop is read by non-telegram-ui markup), but if anything about the admin screens visibly breaks, note it — that's a real regression to flag, not something to silently patch by touching admin code (out of scope for this plan).

- [ ] **Step 13: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/lib/telegramTheme.ts frontend/src/hooks/useTelegramTheme.ts frontend/src/hooks/useTelegramAppearance.ts frontend/src/main.tsx frontend/src/App.tsx frontend/tests/hooks/useTelegramAppearance.test.ts
git commit -m "frontend: install telegram-ui, wrap app in AppRoot with reactive appearance"
```

---

## Task 2: Calendar grid pure function

**Files:**
- Create: `frontend/src/lib/calendarGrid.ts`
- Test: `frontend/tests/lib/calendarGrid.test.ts`

**Interfaces:**
- Produces: `CalendarDay { date: string; enabled: boolean }`, `CalendarWeek = (CalendarDay | null)[]`, `generateCalendarWeeks(todayISO: string, horizonDays: number): CalendarWeek[]`, exported from `frontend/src/lib/calendarGrid.ts`. Consumed by Task 3's `SelectSlot.tsx`.

- [ ] **Step 1: Write the failing test — `frontend/tests/lib/calendarGrid.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { generateCalendarWeeks } from '../../src/lib/calendarGrid';

describe('generateCalendarWeeks', () => {
  it('generates a single-month grid when the horizon stays within one month', () => {
    // 2026-08-01 is a Saturday
    const weeks = generateCalendarWeeks('2026-08-01', 14);

    // Every week has exactly 7 slots
    weeks.forEach((week) => expect(week).toHaveLength(7));

    // First week: Mon 2026-07-27 .. Sun 2026-08-02, so the first 5 cells (Mon-Fri, July) are null padding
    expect(weeks[0].slice(0, 5)).toEqual([null, null, null, null, null]);
    expect(weeks[0][5]).toEqual({ date: '2026-08-01', enabled: true }); // Saturday
    expect(weeks[0][6]).toEqual({ date: '2026-08-02', enabled: true }); // Sunday

    // Last enabled date is 2026-08-01 + 13 days = 2026-08-14
    const flat = weeks.flat().filter((d): d is { date: string; enabled: boolean } => d !== null);
    const enabledDates = flat.filter((d) => d.enabled).map((d) => d.date);
    expect(enabledDates[0]).toBe('2026-08-01');
    expect(enabledDates[enabledDates.length - 1]).toBe('2026-08-14');
    expect(enabledDates).toHaveLength(14);

    // Days after the horizon are present (padding out August) but disabled
    const aug15 = flat.find((d) => d.date === '2026-08-15');
    expect(aug15).toEqual({ date: '2026-08-15', enabled: false });

    // Grid does not extend into September at all (horizon ends within August)
    expect(flat.some((d) => d.date.startsWith('2026-09'))).toBe(false);
  });

  it('extends the grid into the next month when the horizon crosses a month boundary', () => {
    // 2026-08-25 + 13 days = 2026-09-07
    const weeks = generateCalendarWeeks('2026-08-25', 14);
    const flat = weeks.flat().filter((d): d is { date: string; enabled: boolean } => d !== null);

    const enabledDates = flat.filter((d) => d.enabled).map((d) => d.date);
    expect(enabledDates[0]).toBe('2026-08-25');
    expect(enabledDates[enabledDates.length - 1]).toBe('2026-09-07');
    expect(enabledDates).toHaveLength(14);

    // Full August (from the 1st) and full September (through the 30th) are both present
    expect(flat.some((d) => d.date === '2026-08-01')).toBe(true);
    expect(flat.some((d) => d.date === '2026-09-30')).toBe(true);
    // Nothing from October
    expect(flat.some((d) => d.date.startsWith('2026-10'))).toBe(false);

    // A day in September before the horizon window is disabled
    const sep1 = flat.find((d) => d.date === '2026-09-01');
    expect(sep1).toEqual({ date: '2026-09-01', enabled: false });
  });

  it('handles a 1-day horizon (only today enabled)', () => {
    const weeks = generateCalendarWeeks('2026-08-10', 1);
    const flat = weeks.flat().filter((d): d is { date: string; enabled: boolean } => d !== null);
    const enabledDates = flat.filter((d) => d.enabled).map((d) => d.date);
    expect(enabledDates).toEqual(['2026-08-10']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- tests/lib/calendarGrid.test.ts
```
Expected: FAIL with "Cannot find module '../../src/lib/calendarGrid'".

- [ ] **Step 3: Create `frontend/src/lib/calendarGrid.ts`**

```typescript
import { DateTime } from 'luxon';

export interface CalendarDay {
  date: string; // "YYYY-MM-DD"
  enabled: boolean;
}

export type CalendarWeek = (CalendarDay | null)[]; // always length 7, Monday-first; null = padding

// Monday of the ISO week containing dt, computed from Luxon's locale-independent
// `weekday` (1=Mon..7=Sun) rather than `startOf('week')`, whose first-day-of-week
// depends on the active locale and is not something to assume without checking.
function mondayOf(dt: DateTime): DateTime {
  return dt.startOf('day').minus({ days: dt.weekday - 1 });
}

export function generateCalendarWeeks(todayISO: string, horizonDays: number): CalendarWeek[] {
  const today = DateTime.fromISO(todayISO).startOf('day');
  const lastEnabled = today.plus({ days: horizonDays - 1 });

  const gridStart = today.startOf('month');
  const gridEnd = lastEnabled.endOf('month').startOf('day');

  const weeks: CalendarWeek[] = [];
  let cursor = mondayOf(gridStart);
  const lastWeekStart = mondayOf(gridEnd);

  while (cursor <= lastWeekStart) {
    const week: CalendarWeek = [];
    for (let i = 0; i < 7; i++) {
      if (cursor < gridStart || cursor > gridEnd) {
        week.push(null);
      } else {
        week.push({
          date: cursor.toISODate()!,
          enabled: cursor >= today && cursor <= lastEnabled,
        });
      }
      cursor = cursor.plus({ days: 1 });
    }
    weeks.push(week);
  }
  return weeks;
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test -- tests/lib/calendarGrid.test.ts
```
Expected: PASS (3 tests). If any assertion about padding/enabled dates is off, hand-trace the specific date against the code rather than adjusting the test to match wrong output.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/calendarGrid.ts frontend/tests/lib/calendarGrid.test.ts
git commit -m "frontend: add pure calendar-week generator for the date picker"
```

---

## Task 3: Redesign ServicesList

**Files:**
- Modify: `frontend/src/pages/ServicesList/ServicesList.tsx`
- Modify: `frontend/tests/pages/ServicesList.test.tsx`

**Interfaces:**
- Consumes: `getServices` (unchanged), `List`/`Section`/`Cell`/`Placeholder`/`Spinner` from `@telegram-apps/telegram-ui` (Task 1).
- No new exports — same `ServicesList` component signature.

- [ ] **Step 1: Read the current test file to see exactly what it asserts**

```bash
cat frontend/tests/pages/ServicesList.test.tsx
```
Note both tests: the happy-path test (`getByText('Haircut')`, `getByText('Beard trim')`, `getByText(/1500/)`, `getByText(/30/)`) and the `isPending` regression test (`getByText('Загрузка...')`, asserting `getServicesMock` was never called while offline). Both must keep passing — the regression test in particular must still prove the `isPending`-vs-`isLoading` distinction, not just happen to pass.

- [ ] **Step 2: Modify `frontend/src/pages/ServicesList/ServicesList.tsx`**

```typescript
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { List, Section, Cell, Placeholder, Spinner } from '@telegram-apps/telegram-ui';
import { getServices } from '../../api/services';

export function ServicesList() {
  const { data: services, isPending, error } = useQuery({ queryKey: ['services'], queryFn: getServices });

  // isPending (not isLoading) is the correct "no data yet" check in React Query v5:
  // isLoading is isPending && isFetching, so it drops to false during a failed
  // query's retry-backoff delay even though there's still no data — services!
  // would then crash. isPending stays true for that whole window.
  if (isPending) {
    return (
      <Placeholder header="Загрузка...">
        <Spinner size="m" />
      </Placeholder>
    );
  }
  if (error) {
    return <Placeholder header="Не удалось загрузить услуги" />;
  }

  return (
    <List>
      <Section header="Услуги">
        {services.map((service) => (
          <Cell
            key={service.id}
            Component={Link}
            to={`/booking/${service.id}`}
            subtitle={`${service.price} ₽ · ${service.durationMinutes} мин`}
          >
            {service.name}
          </Cell>
        ))}
      </Section>
      <Section>
        <Cell Component={Link} to="/my-bookings">
          Мои записи
        </Cell>
      </Section>
    </List>
  );
}
```

Note: `services!` (non-null assertion) is no longer needed — TypeScript can narrow `services` to defined after the `isPending`/`error` early returns, since `error` being falsy combined with `isPending` being false guarantees `services` is populated in this query's discriminated result type. If TypeScript still complains here once you run this for real, that's a legitimate signal to keep the assertion — don't fight the type checker, just note it.

If `Component={Link} to="..."` does not typecheck against `CellProps` (its declared type doesn't formally include `to`, only whatever `Component`'s own props are, and rest-prop forwarding may or may not be typed permissively — verify this for real once you run `tsc`), fall back to wrapping instead:

```typescript
<Link to={`/booking/${service.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
  <Cell subtitle={`${service.price} ₽ · ${service.durationMinutes} мин`}>{service.name}</Cell>
</Link>
```

Try the `Component={Link}` polymorphic form first — it's the more idiomatic telegram-ui pattern — but don't fight the compiler if it doesn't accept `to` as a valid prop; use the wrapping fallback instead in that case, and note which form you used in your report.

- [ ] **Step 3: Run the tests, fix selectors as needed**

```bash
npm test -- tests/pages/ServicesList.test.tsx
```

If the happy-path test's `getByText(/1500/)`/`getByText(/30/)` assertions fail because the subtitle text renders as a single combined string (`"1500 ₽ · 30 мин"`) split across DOM nodes in a way Testing Library's default text matcher doesn't find via a loose regex, adjust the assertions to match the actual rendered text (e.g. `getByText('1500 ₽ · 30 мин')` or a regex covering the whole subtitle) — do not weaken the test to just check the element exists without checking its content. Same for the `isPending` regression test's `getByText('Загрузка...')` — `Placeholder`'s `header` prop should render this text somewhere findable; confirm it actually does (read the rendered DOM via `screen.debug()` if the assertion fails, don't guess).

Run twice to confirm no flakiness from the `onlineManager` global state:
```bash
npm test -- tests/pages/ServicesList.test.tsx
npm test -- tests/pages/ServicesList.test.tsx
```
Expected: PASS (2 tests) both times.

- [ ] **Step 4: Run the full suite and typecheck**

```bash
npm test
npx tsc -b
```
Expected: all PASS, clean.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/ServicesList/ServicesList.tsx frontend/tests/pages/ServicesList.test.tsx
git commit -m "frontend: redesign ServicesList with telegram-ui components"
```

---

## Task 4: Redesign SelectSlot (calendar grid + slot chips)

**Files:**
- Modify: `frontend/src/pages/BookingFlow/SelectSlot.tsx`
- Modify: `frontend/tests/pages/SelectSlot.test.tsx`

**Interfaces:**
- Consumes: `generateCalendarWeeks` (Task 2), `Chip`/`Section`/`Placeholder`/`Spinner`/`Text` from `@telegram-apps/telegram-ui` (Task 1). Everything else (hooks, API calls, routing) unchanged.

- [ ] **Step 1: Read the current test file**

```bash
cat frontend/tests/pages/SelectSlot.test.tsx
```
Note what it currently mocks and asserts (service name, slot buttons, navigation on click) — preserve the same behavioral coverage.

- [ ] **Step 2: Modify `frontend/src/pages/BookingFlow/SelectSlot.tsx`**

```typescript
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import { Section, Chip, Placeholder, Spinner, Text } from '@telegram-apps/telegram-ui';
import { getServices } from '../../api/services';
import { getSlots } from '../../api/slots';
import { useBackButton } from '../../hooks/useBackButton';
import { useBusinessSettings } from '../../hooks/useBusinessSettings';
import { generateCalendarWeeks } from '../../lib/calendarGrid';

const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export function SelectSlot() {
  const { serviceId } = useParams<{ serviceId: string }>();
  const navigate = useNavigate();
  const { data: settings, isPending: settingsPending } = useBusinessSettings();

  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useBackButton(() => navigate('/'));

  useEffect(() => {
    if (settings && selectedDate === null) {
      setSelectedDate(DateTime.now().setZone(settings.timezone).toISODate()!);
    }
  }, [settings, selectedDate]);

  const { data: services } = useQuery({ queryKey: ['services'], queryFn: getServices });
  const service = services?.find((s) => s.id === Number(serviceId));

  const { data: slots } = useQuery({
    queryKey: ['slots', serviceId, selectedDate],
    queryFn: () => getSlots(Number(serviceId), selectedDate!),
    enabled: Boolean(serviceId) && selectedDate !== null,
  });

  const weeks = useMemo(() => {
    if (!settings) return [];
    const today = DateTime.now().setZone(settings.timezone).toISODate()!;
    return generateCalendarWeeks(today, settings.bookingHorizonDays);
  }, [settings]);

  function pickSlot(startsAt: string) {
    navigate(`/booking/${serviceId}/confirm?startsAt=${encodeURIComponent(startsAt)}`);
  }

  if (settingsPending || selectedDate === null) {
    return (
      <Placeholder header="Загрузка...">
        <Spinner size="m" />
      </Placeholder>
    );
  }

  return (
    <div>
      <Text weight="2" style={{ display: 'block', padding: '12px 16px' }}>
        {service?.name ?? 'Выбор времени'}
      </Text>

      <div style={{ padding: '0 16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
          {WEEKDAY_LABELS.map((label) => (
            <Text key={label} weight="3" style={{ textAlign: 'center', fontSize: 12, opacity: 0.6 }}>
              {label}
            </Text>
          ))}
        </div>
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
            {week.map((day, dayIndex) =>
              day === null ? (
                <div key={dayIndex} />
              ) : (
                <Chip
                  key={day.date}
                  mode={day.date === selectedDate ? 'elevated' : 'outline'}
                  aria-pressed={day.date === selectedDate}
                  aria-disabled={!day.enabled}
                  onClick={day.enabled ? () => setSelectedDate(day.date) : undefined}
                  style={day.enabled ? { justifyContent: 'center' } : { justifyContent: 'center', opacity: 0.35, pointerEvents: 'none' }}
                >
                  {DateTime.fromISO(day.date).day}
                </Chip>
              )
            )}
          </div>
        ))}
      </div>

      <Section header="Свободное время">
        {slots?.length === 0 && <Placeholder description="Нет свободных слотов на эту дату" />}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '0 16px 16px' }}>
          {slots?.map((slot) => {
            const label = DateTime.fromISO(slot.startsAt).setZone(settings!.timezone).toFormat('HH:mm');
            return (
              <Chip key={slot.startsAt} mode="outline" onClick={() => pickSlot(slot.startsAt)}>
                {label}
              </Chip>
            );
          })}
        </div>
      </Section>
    </div>
  );
}
```

Verify `Text`'s `weight` prop values against the real installed types (`find node_modules/@telegram-apps/telegram-ui/dist/dts/components/Typography -iname "*.d.ts" | xargs cat` — the plan's `weight="2"`/`weight="3"` values are a guess at this component's API surface, not independently verified the way `Cell`/`Chip`/`Placeholder`/`Spinner` were during planning; check and correct before relying on them).

- [ ] **Step 3: Run the tests, fix selectors as needed**

```bash
npm test -- tests/pages/SelectSlot.test.tsx
```

The existing test likely asserts specific date-button labels (e.g. `dd.MM` format) or role-based queries (`getByRole('button', ...)`) that no longer match — `Chip` may not render as a `<button>` element (check `ChipProps`: `Component?: ElementType`, default likely `div`), so `getByRole('button', ...)` queries may need to become `getByRole('button')` alternatives, `getByText`, or use `getByLabelText`/`aria-label` if you add one for the specific date/time being clicked. Rewrite the test's queries to match what the new markup actually renders — read the rendered output (`screen.debug()`) rather than guessing.

- [ ] **Step 4: Run the full suite and typecheck**

```bash
npm test
npx tsc -b
```
Expected: all PASS, clean.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/BookingFlow/SelectSlot.tsx frontend/tests/pages/SelectSlot.test.tsx
git commit -m "frontend: redesign SelectSlot with telegram-ui calendar grid and slot chips"
```

---

## Task 5: Redesign Confirm

**Files:**
- Modify: `frontend/src/pages/BookingFlow/Confirm.tsx`
- Modify: `frontend/tests/pages/Confirm.test.tsx`

**Interfaces:**
- Consumes: `List`/`Section`/`Cell`/`Banner`/`Placeholder`/`Spinner` from `@telegram-apps/telegram-ui` (Task 1). Everything else unchanged.

- [ ] **Step 1: Read the current test file**

```bash
cat frontend/tests/pages/Confirm.test.tsx
```
Note the two tests: happy path (shows client name, service, time; submits via mocked MainButton `onClick`) and the 409-stays-mounted regression test (error text visible, no navigation happened).

- [ ] **Step 2: Modify `frontend/src/pages/BookingFlow/Confirm.tsx`**

```typescript
import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import { List, Section, Cell, Banner, Placeholder, Spinner } from '@telegram-apps/telegram-ui';
import { getServices } from '../../api/services';
import { createBooking } from '../../api/bookings';
import { getWhoAmI } from '../../api/user';
import { ApiError } from '../../api/client';
import { useMainButton } from '../../hooks/useMainButton';
import { useBackButton } from '../../hooks/useBackButton';
import { useBusinessSettings } from '../../hooks/useBusinessSettings';

export function Confirm() {
  const { serviceId } = useParams<{ serviceId: string }>();
  const [searchParams] = useSearchParams();
  const startsAt = searchParams.get('startsAt')!;
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const { data: services } = useQuery({ queryKey: ['services'], queryFn: getServices });
  const service = services?.find((s) => s.id === Number(serviceId));
  const { data: me } = useQuery({ queryKey: ['whoami'], queryFn: getWhoAmI });
  const { data: settings, isPending: settingsPending } = useBusinessSettings();

  useBackButton(() => navigate(-1));

  async function handleConfirm() {
    setError(null);
    try {
      await createBooking({ serviceId: Number(serviceId), startsAt });
      navigate('/my-bookings');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('Этот слот только что заняли, выберите другое время');
      } else {
        setError('Не удалось создать запись, попробуйте ещё раз');
      }
    }
  }

  useMainButton({ text: 'Записаться', onClick: handleConfirm, enabled: Boolean(service) });

  if (!service || settingsPending || !settings) {
    return (
      <Placeholder header="Загрузка...">
        <Spinner size="m" />
      </Placeholder>
    );
  }

  const dt = DateTime.fromISO(startsAt, { zone: 'utc' }).setZone(settings.timezone);

  return (
    <div>
      <List>
        <Section header={service.name}>
          {me?.firstName && <Cell subtitle="Записываем">{me.firstName}</Cell>}
          <Cell subtitle="Дата и время">{`${dt.toFormat('dd.MM.yyyy')} в ${dt.toFormat('HH:mm')}`}</Cell>
          <Cell subtitle="Стоимость">{`${service.price} ₽ · ${service.durationMinutes} мин`}</Cell>
        </Section>
      </List>
      {error && (
        <div role="alert">
          <Banner type="inline" header={error} />
        </div>
      )}
    </div>
  );
}
```

The wrapping `<div role="alert">` around `Banner` preserves the existing accessibility contract (the current test may query by `getByRole('alert')`) without assuming `Banner` itself sets that role — verify whether `Banner`'s rendered output already includes `role="alert"` (check `find node_modules/@telegram-apps/telegram-ui/dist/dts/components/Blocks/Banner -iname "*.js" | xargs grep -i role` on the compiled output, or just render it in a test and inspect) and remove the wrapping div if redundant.

- [ ] **Step 3: Run the tests, fix selectors as needed**

```bash
npm test -- tests/pages/Confirm.test.tsx
```

If assertions were checking specific `<p>`/`<h1>` text nodes that no longer exist in this exact form, update them to match the new structure while preserving what each assertion actually verifies (client name shown, service name shown, date/time shown, error message shown and component still mounted after a 409). Do not delete an assertion just because its selector broke — fix the selector.

- [ ] **Step 4: Run the full suite and typecheck**

```bash
npm test
npx tsc -b
```
Expected: all PASS, clean.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/BookingFlow/Confirm.tsx frontend/tests/pages/Confirm.test.tsx
git commit -m "frontend: redesign Confirm with telegram-ui components"
```

---

## Task 6: Redesign MyBookings

**Files:**
- Modify: `frontend/src/pages/MyBookings/MyBookings.tsx`
- Modify: `frontend/tests/pages/MyBookings.test.tsx`

**Interfaces:**
- Consumes: `List`/`Section`/`Cell`/`Badge`/`Button` from `@telegram-apps/telegram-ui` (Task 1). Everything else unchanged.

- [ ] **Step 1: Read the current test file**

```bash
cat frontend/tests/pages/MyBookings.test.tsx
```
Note both tests: listing bookings and cancelling one (asserting `cancelBooking` called with the right id after a click), and not showing a cancel control on an already-cancelled booking.

- [ ] **Step 2: Modify `frontend/src/pages/MyBookings/MyBookings.tsx`**

```typescript
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import { List, Section, Cell, Badge, Button, Placeholder, Spinner } from '@telegram-apps/telegram-ui';
import { getMyBookings, cancelBooking } from '../../api/bookings';
import { useBackButton } from '../../hooks/useBackButton';
import { useBusinessSettings } from '../../hooks/useBusinessSettings';
import { useNavigate } from 'react-router-dom';

export function MyBookings() {
  const navigate = useNavigate();
  useBackButton(() => navigate('/'));

  const queryClient = useQueryClient();
  const { data: bookings } = useQuery({ queryKey: ['myBookings'], queryFn: getMyBookings });
  const { data: settings, isPending: settingsPending } = useBusinessSettings();

  const cancelMutation = useMutation({
    mutationFn: (id: number) => cancelBooking(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['myBookings'] }),
  });

  if (settingsPending || !settings) {
    return (
      <Placeholder header="Загрузка...">
        <Spinner size="m" />
      </Placeholder>
    );
  }

  return (
    <List>
      <Section header="Мои записи">
        {bookings?.map((booking) => {
          const dt = DateTime.fromISO(booking.startsAt).setZone(settings.timezone);
          const isConfirmed = booking.status === 'confirmed';
          return (
            <Cell
              key={booking.id}
              subtitle={`${dt.toFormat('dd.MM.yyyy')} в ${dt.toFormat('HH:mm')}`}
              after={
                <Badge type="dot" mode={isConfirmed ? 'primary' : 'gray'}>
                  {isConfirmed ? 'Подтверждена' : 'Отменена'}
                </Badge>
              }
            >
              {booking.serviceName}
              {isConfirmed && (
                <div style={{ marginTop: 8 }}>
                  <Button size="s" mode="outline" onClick={() => cancelMutation.mutate(booking.id)}>
                    Отменить
                  </Button>
                </div>
              )}
            </Cell>
          );
        })}
      </Section>
    </List>
  );
}
```

Check `Badge`'s `type="dot"` rendering — per its type signature, `type: 'dot'` renders "a simple dot" with no visible text content, which would make the status text disappear even though it's passed as `children`. If `Badge`'s `dot` variant genuinely doesn't render children text (verify by reading `find node_modules/@telegram-apps/telegram-ui/dist/dts/components/Blocks/Badge -iname "*.js" | xargs cat`), switch to `type="number"` is wrong too (that's for counts) — instead render the status label as a separate `Text`/`Caption` element next to a `Badge type="dot"` used purely as a status-color indicator, or skip `Badge` for the status label entirely and use plain text with a color style keyed off `isConfirmed`. Decide based on what the component actually does, not the guess above.

- [ ] **Step 3: Run the tests, fix selectors as needed**

```bash
npm test -- tests/pages/MyBookings.test.tsx
```

Verify the cancel button is still findable via `getByRole('button', { name: /отменить/i })` (or similar) and still absent for cancelled bookings — `telegram-ui`'s `Button` should render a real `<button>` per its type (`ButtonProps extends AllHTMLAttributes<HTMLButtonElement>`), so role-based queries should keep working here, unlike `Chip` in Task 4.

- [ ] **Step 4: Run the full suite and typecheck**

```bash
npm test
npx tsc -b
```
Expected: all PASS, clean.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/MyBookings/MyBookings.tsx frontend/tests/pages/MyBookings.test.tsx
git commit -m "frontend: redesign MyBookings with telegram-ui components"
```

---

## Task 7: Final verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full frontend suite one more time from a clean state**

```bash
cd frontend
npm test
npx tsc -b
```
Expected: all tests PASS, clean typecheck.

- [ ] **Step 2: Start both dev servers and manually load the app in a browser**

```bash
# terminal 1
cd backend && npm run dev
# terminal 2
cd frontend && npm run dev
```
Open `http://localhost:5173`. Outside real Telegram, `initData` is empty and `/api/*` calls will 401 after React Query's retries exhaust (this is expected, documented behavior — see `frontend/README.md`) — but confirm: no blank white screen, no uncaught console exceptions, the `Placeholder`/`Spinner` loading state renders correctly, and the eventual error state renders via `Placeholder` without crashing. This mirrors the manual verification that caught two real bugs during the original build (Task 18 of the prior plan) — don't skip it just because unit tests pass.

- [ ] **Step 3: Report a summary of what manual verification found**, including anything that couldn't be verified outside real Telegram (visual appearance of `AppRoot`'s platform-specific styling, `Chip`/`Cell` rendering on iOS vs Android — these require testing inside a real Telegram client via a tunnel, per `frontend/README.md`, and are reasonable to flag as follow-up rather than block this plan on).
