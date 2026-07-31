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
          bottom padding to avoid being covered. 80px is headroom above both
          of telegram-ui's shipped platform heights for a text-only (no icon)
          Tabbar.Item at the enlarged 18px caption line-height set below:
          "base" is `12px 16px 16px` padding + 18px line-height ≈ 46px; "ios"
          is `8px 12px 4px` padding + 18px line-height + env(safe-area-inset-
          bottom), ≈67px worst case on a notched device. */}
      <div style={{ paddingBottom: 80 }}>
        {tab === 'bookings' ? <AdminBookings /> : <AdminServices />}
      </div>
      <Tabbar
        style={
          {
            // TabbarItem's label is a telegram-ui Caption, rendered at
            // caption2 (11px) on iOS and caption1 (13px) elsewhere — with no
            // icon next to it (we don't have any), that reads as noticeably
            // tiny, especially on iOS. These custom properties are the exact
            // ones Caption's own CSS reads for font-size/line-height, so
            // overriding them here (scoped to Tabbar, not app-wide) bumps
            // both platforms to the same larger, legible size — same
            // technique already used for the time-slot Chips in SelectSlot.
            '--tgui--caption1--font_size': '14px',
            '--tgui--caption1--line_height': '18px',
            '--tgui--caption2--font_size': '14px',
            '--tgui--caption2--line_height': '18px',
          } as CSSProperties
        }
      >
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
