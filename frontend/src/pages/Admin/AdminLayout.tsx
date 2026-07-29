import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
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
  if (isPending) return <p>Загрузка...</p>;
  if (me?.role !== 'admin') return <Navigate to="/" replace />;

  return (
    <div>
      <nav>
        <button onClick={() => setTab('bookings')}>Записи на день</button>
        <button onClick={() => setTab('services')}>Услуги</button>
      </nav>
      {tab === 'bookings' ? <AdminBookings /> : <AdminServices />}
    </div>
  );
}
