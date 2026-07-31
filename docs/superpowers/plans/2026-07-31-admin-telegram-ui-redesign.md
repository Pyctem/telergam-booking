# Admin Panel telegram-ui Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bare-HTML admin screens (`AdminLayout`, `AdminBookings`, `AdminServices`) with `@telegram-apps/telegram-ui` components, closing the scope gap the 2026-07-30 client-flow redesign plan deliberately left open.

**Architecture:** Same integration already in place for the client screens — `App.tsx`'s `<AppRoot>` wrapper and `--tgui--*` CSS variables need no changes. Only JSX inside the three admin page components changes; `useBusinessSettings`, the entire `api/admin.ts`/`api/user.ts` layer, and all mutation/query logic stay untouched. No new dependencies — `@telegram-apps/telegram-ui` is already installed (`^2.1.13`).

**Tech Stack:** `@telegram-apps/telegram-ui` (already installed), `@tanstack/react-query`, `luxon` — all pre-existing, no additions.

## Global Constraints

- Component props referenced below were verified by reading the installed package directly: `find node_modules/@telegram-apps/telegram-ui/dist/components/<Path> -iname "*.d.ts"` for prop types, and the paired `.js` file for runtime behavior the `.d.ts` doesn't show (e.g. `Tabbar`'s fixed positioning, `Input`'s `header` placement). This version of the package ships types under `dist/components/**/*.d.ts`, not `dist/dts/` — don't assume the older path some other docs/plans in this repo reference.
- `@telegram-apps/telegram-ui` components throw `[TGUI] Wrap your app with <AppRoot> component` when rendered outside an `<AppRoot>` ancestor (confirmed by reading `useAppRootContext.js`). Every test in this plan renders through `frontend/tests/testUtils.tsx`'s `renderWithProviders` (already wraps in `<AppRoot>`), not a bare `QueryClientProvider`/`MemoryRouter` pair.
- `Tabbar` always renders `position: fixed` at the viewport **bottom** — its public prop type doesn't expose `FixedLayout`'s `vertical` override, so don't attempt `<Tabbar vertical="top">`; it won't typecheck and wouldn't be honored at runtime either.
- No business logic, API calls, or data-fetching hooks change in this plan — only markup inside the three admin components.
- Existing tests' API mocks (`vi.mock('../../src/api/admin')`, etc.) must keep working — only update assertions/render setup that depend on markup structure, not the mocking strategy.
- TypeScript strict mode. `MemoryRouter` in tests must keep `future={{ v7_startTransition: true, v7_relativeSplatPath: true }}` (already the default inside `renderWithProviders`).
- Test output must stay pristine (no console warnings/errors beyond what's already expected and asserted-on).

---

## File Structure Overview

```
frontend/
├── src/
│   └── pages/
│       └── Admin/
│           ├── AdminLayout.tsx      # modified: Tabbar nav, Placeholder/Spinner loading
│           ├── AdminBookings.tsx    # modified: List/Section/Cell, Input date field
│           └── AdminServices.tsx    # modified: List/Section/Cell, Input form, Button
└── tests/
    └── pages/
        ├── AdminLayout.test.tsx     # modified: renderWithProviders, same assertions
        ├── AdminBookings.test.tsx   # new: didn't exist before this plan
        └── AdminServices.test.tsx   # modified: renderWithProviders, same assertions
```

---

## Task 1: Redesign AdminLayout (Tabbar nav)

**Files:**
- Modify: `frontend/src/pages/Admin/AdminLayout.tsx`
- Modify: `frontend/tests/pages/AdminLayout.test.tsx`

**Interfaces:**
- Consumes: `Tabbar`/`Placeholder`/`Spinner` from `@telegram-apps/telegram-ui`. `AdminBookings`/`AdminServices` (Tasks 2-3) rendered as before, same no-props signature.
- No new exports — same `AdminLayout` component signature.

- [ ] **Step 1: Read the current test file**

```bash
cat frontend/tests/pages/AdminLayout.test.tsx
```
Note all three tests: redirect for non-admin, tab rendering for admin (`getByText("Today's Bookings")`, `getByRole('button', { name: 'Services' })`), and the `isPending`-vs-`isLoading` regression test (`getByText('Loading...')`, asserting `getWhoAmI` never called while offline). All three must keep passing with unchanged behavioral coverage.

- [ ] **Step 2: Modify `frontend/src/pages/Admin/AdminLayout.tsx`**

```typescript
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { Tabbar, Placeholder, Spinner } from '@telegram-apps/telegram-ui';
import { getWhoAmI } from '../../api/user';
import { AdminBookings } from './AdminBookings';
import { AdminServices } from './AdminServices';

export function AdminLayout() {
  const { data: me, isPending } = useQuery({ queryKey: ['whoami'], queryFn: getWhoAmI });
  const [tab, setTab] = useState<'bookings' | 'services'>('bookings');

  // isPending (not isLoading) — see ServicesList.tsx for why. Using isLoading here
  // could redirect an actual admin to "/" during a retry-backoff window where
  // isLoading is already false but `me` hasn't arrived yet, since me?.role would
  // read as undefined ("not admin") instead of "still finding out".
  if (isPending) {
    return (
      <Placeholder header="Loading...">
        <Spinner size="m" />
      </Placeholder>
    );
  }
  if (me?.role !== 'admin') return <Navigate to="/" replace />;

  return (
    <div>
      {/* Tabbar renders position:fixed to the viewport bottom (telegram-ui's
          Tabbar always uses FixedLayout's default vertical="bottom" and has
          no public prop to override it), so the content above it needs
          bottom padding to avoid being covered. 72px is an estimate for a
          text-only (no icon) Tabbar.Item — confirm/adjust against the real
          rendered height during Task 4's manual browser check. */}
      <div style={{ paddingBottom: 72 }}>
        {tab === 'bookings' ? <AdminBookings /> : <AdminServices />}
      </div>
      <Tabbar>
        {/* "Bookings", not "Today's Bookings" — AdminBookings renders a
            Section with that exact header text below, and having the tab
            label duplicate it breaks getByText's uniqueness assumption in
            tests (and reads as redundant to a sighted user regardless). */}
        <Tabbar.Item text="Bookings" selected={tab === 'bookings'} onClick={() => setTab('bookings')} />
        <Tabbar.Item text="Services" selected={tab === 'services'} onClick={() => setTab('services')} />
      </Tabbar>
    </div>
  );
}
```

- [ ] **Step 3: Modify `frontend/tests/pages/AdminLayout.test.tsx`**

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { onlineManager } from '@tanstack/react-query';
import { Routes, Route } from 'react-router-dom';
import { AdminLayout } from '../../src/pages/Admin/AdminLayout';
import * as userApi from '../../src/api/user';
import * as settingsApi from '../../src/api/settings';
import * as adminApi from '../../src/api/admin';
import { renderWithProviders } from '../testUtils';

vi.mock('../../src/api/user');
vi.mock('../../src/api/settings');
vi.mock('../../src/api/admin');

afterEach(() => {
  onlineManager.setOnline(true);
});

function renderAdmin() {
  renderWithProviders(
    <Routes>
      <Route path="/admin" element={<AdminLayout />} />
      <Route path="/" element={<div>Home screen</div>} />
    </Routes>,
    { initialEntries: ['/admin'] }
  );
}

describe('AdminLayout', () => {
  it('redirects a client (non-admin) to /', async () => {
    vi.spyOn(userApi, 'getWhoAmI').mockResolvedValue({ id: 1, telegramId: 10, role: 'client', firstName: 'Ann' });

    renderAdmin();

    await waitFor(() => expect(screen.getByText('Home screen')).toBeInTheDocument());
  });

  it('renders the admin bookings tab for an admin', async () => {
    vi.spyOn(userApi, 'getWhoAmI').mockResolvedValue({ id: 1, telegramId: 10, role: 'admin', firstName: 'Boss' });
    vi.spyOn(settingsApi, 'getSettings').mockResolvedValue({ timezone: 'Europe/Moscow', bookingHorizonDays: 14 });
    vi.spyOn(adminApi, 'getAdminBookings').mockResolvedValue([]);

    renderAdmin();

    await waitFor(() => expect(screen.getByText("Today's Bookings")).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Services' })).toBeInTheDocument();
    expect(screen.queryByText('Home screen')).not.toBeInTheDocument();
  });

  it('shows the loading state, not a premature redirect, while no data has arrived and isLoading is already false (isPending regression)', async () => {
    onlineManager.setOnline(false);
    const getWhoAmIMock = vi.spyOn(userApi, 'getWhoAmI').mockImplementation(() => new Promise(() => {}));

    renderAdmin();

    await waitFor(() => expect(screen.getByText('Loading...')).toBeInTheDocument());
    expect(screen.queryByText('Home screen')).not.toBeInTheDocument();
    expect(getWhoAmIMock).not.toHaveBeenCalled();

    onlineManager.setOnline(true);
  });
});
```

- [ ] **Step 4: Run the test, fix selectors as needed**

```bash
npm test -- tests/pages/AdminLayout.test.tsx
```
If `getByText("Today's Bookings")` fails as ambiguous (matching more than one node), re-check Step 2's Tabbar label is actually "Bookings" and not "Today's Bookings" — that duplication is exactly what this rename avoids. Don't weaken the assertion; fix the source of the collision.

Run twice to confirm no flakiness from the `onlineManager` global state:
```bash
npm test -- tests/pages/AdminLayout.test.tsx
npm test -- tests/pages/AdminLayout.test.tsx
```
Expected: PASS (3 tests) both times.

- [ ] **Step 5: Run the full suite and typecheck**

```bash
npm test
npx tsc -b
```
Expected: all PASS, clean. (`AdminBookings`/`AdminServices` are still on their pre-Task-2/3 markup at this point — that's fine, this task only touches `AdminLayout.tsx`'s own JSX and doesn't require the sibling components to be redesigned yet.)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/Admin/AdminLayout.tsx frontend/tests/pages/AdminLayout.test.tsx
git commit -m "frontend: redesign AdminLayout with telegram-ui Tabbar"
```

---

## Task 2: Redesign AdminBookings (list + date field)

**Files:**
- Modify: `frontend/src/pages/Admin/AdminBookings.tsx`
- Create: `frontend/tests/pages/AdminBookings.test.tsx`

**Interfaces:**
- Consumes: `List`/`Section`/`Cell`/`Input`/`Placeholder`/`Spinner` from `@telegram-apps/telegram-ui`. `getAdminBookings` (unchanged), `useBusinessSettings` (unchanged).
- No new exports — same `AdminBookings` component signature.

- [ ] **Step 1: Modify `frontend/src/pages/Admin/AdminBookings.tsx`**

```typescript
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import { List, Section, Cell, Input, Placeholder, Spinner } from '@telegram-apps/telegram-ui';
import { getAdminBookings } from '../../api/admin';
import { useBusinessSettings } from '../../hooks/useBusinessSettings';

export function AdminBookings() {
  const { data: settings, isPending: settingsPending } = useBusinessSettings();

  // Same reasoning as SelectSlot: "today" depends on the business's
  // timezone, which isn't known until settings load, so date starts out
  // unknown rather than defaulting to the device's local "today".
  const [date, setDate] = useState<string | null>(null);

  useEffect(() => {
    if (settings && date === null) {
      setDate(DateTime.now().setZone(settings.timezone).toISODate()!);
    }
  }, [settings, date]);

  const { data: bookings } = useQuery({
    queryKey: ['adminBookings', date],
    queryFn: () => getAdminBookings(date!),
    enabled: date !== null,
  });

  if (settingsPending || !settings || date === null) {
    return (
      <Placeholder header="Loading...">
        <Spinner size="m" />
      </Placeholder>
    );
  }

  return (
    <List>
      <Section header="Today's Bookings">
        <Input
          type="date"
          header="Date"
          aria-label="Date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        {bookings?.length === 0 && <Placeholder description="No bookings for this date" />}
        {bookings?.map((booking) => (
          <Cell
            key={booking.id}
            subtitle={DateTime.fromISO(booking.startsAt).setZone(settings.timezone).toFormat('HH:mm')}
          >
            {`${booking.clientFirstName ?? booking.clientUsername ?? '—'} · ${booking.serviceName}`}
          </Cell>
        ))}
      </Section>
    </List>
  );
}
```

Note: `Input`'s `header` prop renders a visible label only on the `base` platform (confirmed by reading `Input.js`/`FormInput.js` — the header text renders as a sibling of the `<label>`, not inside it, and only when `usePlatform() === 'base'`), so it alone doesn't give the field an accessible name on `ios` or via implicit label association. `aria-label="Date"` is what `getByLabelText` in tests actually keys off — keep both props together, don't drop `aria-label` even though `header` looks redundant with it.

- [ ] **Step 2: Create the failing/new test file `frontend/tests/pages/AdminBookings.test.tsx`**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { AdminBookings } from '../../src/pages/Admin/AdminBookings';
import * as adminApi from '../../src/api/admin';
import * as settingsApi from '../../src/api/settings';
import { renderWithProviders } from '../testUtils';

vi.mock('../../src/api/admin');
vi.mock('../../src/api/settings');

describe('AdminBookings', () => {
  it('lists bookings for the current date with client, service, and time', async () => {
    vi.spyOn(settingsApi, 'getSettings').mockResolvedValue({ timezone: 'Europe/Moscow', bookingHorizonDays: 14 });
    vi.spyOn(adminApi, 'getAdminBookings').mockResolvedValue([
      {
        id: 1,
        clientFirstName: 'Ann',
        clientUsername: null,
        serviceName: 'Haircut',
        startsAt: '2026-07-31T06:00:00.000Z',
        endsAt: '2026-07-31T06:30:00.000Z',
        status: 'confirmed',
      },
    ]);

    renderWithProviders(<AdminBookings />);

    await waitFor(() => expect(screen.getByText(/Ann · Haircut/)).toBeInTheDocument());
    // 06:00 UTC -> Europe/Moscow (UTC+3, no DST) -> 09:00
    expect(screen.getByText('09:00')).toBeInTheDocument();
  });

  it('shows a placeholder when there are no bookings for the selected date', async () => {
    vi.spyOn(settingsApi, 'getSettings').mockResolvedValue({ timezone: 'Europe/Moscow', bookingHorizonDays: 14 });
    vi.spyOn(adminApi, 'getAdminBookings').mockResolvedValue([]);

    renderWithProviders(<AdminBookings />);

    await waitFor(() => expect(screen.getByText('No bookings for this date')).toBeInTheDocument());
  });

  it('refetches bookings for the newly selected date', async () => {
    vi.spyOn(settingsApi, 'getSettings').mockResolvedValue({ timezone: 'Europe/Moscow', bookingHorizonDays: 14 });
    const getAdminBookingsMock = vi.spyOn(adminApi, 'getAdminBookings').mockResolvedValue([]);

    renderWithProviders(<AdminBookings />);

    await waitFor(() => expect(getAdminBookingsMock).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-08-15' } });

    await waitFor(() => expect(getAdminBookingsMock).toHaveBeenCalledWith('2026-08-15'));
  });
});
```

- [ ] **Step 3: Run the new test**

```bash
npm test -- tests/pages/AdminBookings.test.tsx
```
Expected: PASS (3 tests). If `getByText(/Ann · Haircut/)` fails because the Cell renders the two parts as separate text nodes instead of one combined string, read the actual rendered DOM (`screen.debug()`) and adjust the regex/matcher to what's actually there — don't weaken the assertion to just "element exists" without checking its content.

- [ ] **Step 4: Run the full suite and typecheck**

```bash
npm test
npx tsc -b
```
Expected: all PASS, clean.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Admin/AdminBookings.tsx frontend/tests/pages/AdminBookings.test.tsx
git commit -m "frontend: redesign AdminBookings with telegram-ui List/Cell"
```

---

## Task 3: Redesign AdminServices (list + form)

**Files:**
- Modify: `frontend/src/pages/Admin/AdminServices.tsx`
- Modify: `frontend/tests/pages/AdminServices.test.tsx`

**Interfaces:**
- Consumes: `List`/`Section`/`Cell`/`Input`/`Button` from `@telegram-apps/telegram-ui`. `getAdminServices`/`createAdminService`/`deleteAdminService` (unchanged).
- No new exports — same `AdminServices` component signature.

- [ ] **Step 1: Read the current test file**

```bash
cat frontend/tests/pages/AdminServices.test.tsx
```
Note the single test: lists a service, fills the form via `getByLabelText(/name|price|duration/i)`, submits via `getByRole('button', { name: /add/i })`, asserts `createAdminService` called with the right payload.

- [ ] **Step 2: Modify `frontend/src/pages/Admin/AdminServices.tsx`**

```typescript
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { List, Section, Cell, Input, Button } from '@telegram-apps/telegram-ui';
import { getAdminServices, createAdminService, deleteAdminService } from '../../api/admin';

export function AdminServices() {
  const queryClient = useQueryClient();
  const { data: services } = useQuery({ queryKey: ['adminServices'], queryFn: getAdminServices });
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');

  const createMutation = useMutation({
    mutationFn: (input: { name: string; price: number; durationMinutes: number }) => createAdminService(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminServices'] });
      setName('');
      setPrice('');
      setDurationMinutes('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteAdminService(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['adminServices'] }),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate({ name, price: Number(price), durationMinutes: Number(durationMinutes) });
  }

  return (
    <List>
      <Section header="Services">
        {services?.map((service) => (
          <Cell
            key={service.id}
            subtitle={`${service.price} ₽, ${service.durationMinutes} min`}
            after={
              service.isActive ? (
                <Button size="s" mode="outline" onClick={() => deleteMutation.mutate(service.id)}>
                  Delete
                </Button>
              ) : undefined
            }
          >
            {service.name}
          </Cell>
        ))}
      </Section>
      <Section>
        <form onSubmit={handleSubmit}>
          <Input header="Name" aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input
            header="Price"
            aria-label="Price"
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          <Input
            header="Duration"
            aria-label="Duration"
            type="number"
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(e.target.value)}
          />
          <div style={{ padding: '12px 24px' }}>
            <Button type="submit" mode="filled" stretched>
              Add
            </Button>
          </div>
        </form>
      </Section>
    </List>
  );
}
```

Same `header`-doesn't-give-an-accessible-name caveat as Task 2's `Input` usage applies here — `aria-label` on each field is what keeps `getByLabelText(/name|price|duration/i)` working.

- [ ] **Step 3: Modify `frontend/tests/pages/AdminServices.test.tsx`**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { AdminServices } from '../../src/pages/Admin/AdminServices';
import * as adminApi from '../../src/api/admin';
import { renderWithProviders } from '../testUtils';

vi.mock('../../src/api/admin');

describe('AdminServices', () => {
  it('lists services and creates a new one from the form', async () => {
    vi.spyOn(adminApi, 'getAdminServices').mockResolvedValue([
      { id: 1, name: 'Haircut', description: null, price: 1500, durationMinutes: 30, isActive: true },
    ]);
    const createMock = vi.spyOn(adminApi, 'createAdminService').mockResolvedValue({ id: 2 });

    renderWithProviders(<AdminServices />);

    await waitFor(() => expect(screen.getByText('Haircut')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Beard trim' } });
    fireEvent.change(screen.getByLabelText(/price/i), { target: { value: '800' } });
    fireEvent.change(screen.getByLabelText(/duration/i), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: /add/i }));

    await waitFor(() =>
      expect(createMock).toHaveBeenCalledWith({ name: 'Beard trim', price: 800, durationMinutes: 20 })
    );
  });

  it('shows a delete button only for active services', async () => {
    vi.spyOn(adminApi, 'getAdminServices').mockResolvedValue([
      { id: 1, name: 'Haircut', description: null, price: 1500, durationMinutes: 30, isActive: true },
      { id: 2, name: 'Retired combo', description: null, price: 2000, durationMinutes: 45, isActive: false },
    ]);
    const deleteMock = vi.spyOn(adminApi, 'deleteAdminService').mockResolvedValue(undefined);

    renderWithProviders(<AdminServices />);

    await waitFor(() => expect(screen.getByText('Haircut')).toBeInTheDocument());
    expect(screen.getAllByRole('button', { name: /delete/i })).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: /delete/i }));

    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith(1));
  });
});
```

- [ ] **Step 4: Run the tests, fix selectors as needed**

```bash
npm test -- tests/pages/AdminServices.test.tsx
```
Expected: PASS (2 tests). If `getByLabelText` fails to find a field, read the rendered DOM (`screen.debug()`) — `Input`'s `aria-label` should be a plain attribute on the underlying `<input>`, findable regardless of the `header` prop's platform-conditional rendering discussed in Task 2. Don't guess; confirm against the actual output.

- [ ] **Step 5: Run the full suite and typecheck**

```bash
npm test
npx tsc -b
```
Expected: all PASS, clean.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/Admin/AdminServices.tsx frontend/tests/pages/AdminServices.test.tsx
git commit -m "frontend: redesign AdminServices with telegram-ui List/Cell/Input"
```

---

## Task 4: Final verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full frontend suite one more time from a clean state**

```bash
cd frontend
npm test
npx tsc -b
```
Expected: all tests PASS, clean typecheck.

- [ ] **Step 2: Start both dev servers and manually load the admin panel in a browser**

```bash
# terminal 1
cd backend && npm run dev
# terminal 2
cd frontend && npm run dev
```
Outside real Telegram, reaching `/admin` requires a mocked or real admin session per `frontend/README.md`'s documented local-dev setup — follow whatever route this repo already uses to exercise `/admin` locally (check `frontend/README.md` if unclear; don't invent a bypass). Once loaded, confirm:
- The `Tabbar` sits fixed at the bottom, "Bookings" and "Services" are both reachable, and the selected tab is visually distinct.
- The content area's `paddingBottom: 72` (Task 1) is actually enough to keep the last list item / form button from being covered by the Tabbar — adjust the constant in `AdminLayout.tsx` if not, and re-run Task 1's test to confirm nothing broke.
- On the Bookings tab: changing the date input reloads the list; an empty date shows the "No bookings for this date" placeholder.
- On the Services tab: the form clears after a successful add; Delete only appears on active services and removes the row after confirming with the backend.
- No blank white screen, no uncaught console exceptions, loading states render via `Placeholder`/`Spinner` without crashing.

- [ ] **Step 3: Report a summary of what manual verification found**, including the actual measured value used for `paddingBottom` if it differed from the 72px placeholder, and anything that couldn't be verified outside real Telegram (platform-specific `Tabbar`/`Input` styling on iOS vs Android) — reasonable to flag as follow-up rather than block this plan on, consistent with how the original client-flow redesign plan treated the same class of limitation.
