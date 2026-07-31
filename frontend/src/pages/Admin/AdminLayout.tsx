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
          bottom padding to avoid being covered. 72px is headroom above both
          of telegram-ui's shipped platform heights for a text-only (no icon)
          Tabbar.Item: "base" is `12px 16px 16px` padding + ~16px caption
          line-height ≈ 44px; "ios" is `8px 12px 4px` padding + caption +
          env(safe-area-inset-bottom), ≈62px worst case on a notched device. */}
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
