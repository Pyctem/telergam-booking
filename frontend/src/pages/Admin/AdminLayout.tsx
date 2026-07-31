import { useState } from 'react';
import type { CSSProperties } from 'react';
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
          bottom padding to avoid being covered. 120px is headroom above the
          worst-case height once both the enlarged 26px caption line-height
          and the enlarged per-item padding below are accounted for: 20px +
          24px vertical padding + 26px line-height ≈ 70px, plus up to ~34px
          of env(safe-area-inset-bottom) on a notched iPhone ≈ 104px. The
          item's own padding is a plain (non-custom-property) value in
          telegram-ui's CSS, so it can only be changed via an inline `style`
          override on each Tabbar.Item (inline style always wins over any
          class rule, on every platform) rather than the CSS-variable trick
          used for the caption size below. */}
      <div style={{ paddingBottom: 120 }}>
        {tab === 'bookings' ? <AdminBookings /> : <AdminServices />}
      </div>
      <Tabbar
        style={
          {
            // TabbarItem's label is a telegram-ui Caption, rendered at
            // caption2 (11px) on iOS and caption1 (13px) elsewhere — with no
            // icon next to it (we don't have any), that read as too small on
            // a real device even at a first, more modest bump. These custom
            // properties are the exact ones Caption's own CSS reads for
            // font-size/line-height, so overriding them here (scoped to
            // Tabbar, not app-wide) roughly doubles the original iOS size —
            // same technique already used for the time-slot Chips in
            // SelectSlot.
            '--tgui--caption1--font_size': '22px',
            '--tgui--caption1--line_height': '26px',
            '--tgui--caption2--font_size': '22px',
            '--tgui--caption2--line_height': '26px',
          } as CSSProperties
        }
      >
        {/* "Bookings", not "Today's Bookings" — AdminBookings renders a
            Section with that exact header text below, and having the tab
            label duplicate it breaks getByText's uniqueness assumption in
            tests (and reads as redundant to a sighted user regardless). */}
        <Tabbar.Item
          text="Bookings"
          selected={tab === 'bookings'}
          onClick={() => setTab('bookings')}
          style={{ padding: '20px 16px 24px' }}
        />
        <Tabbar.Item
          text="Services"
          selected={tab === 'services'}
          onClick={() => setTab('services')}
          style={{ padding: '20px 16px 24px' }}
        />
      </Tabbar>
    </div>
  );
}
