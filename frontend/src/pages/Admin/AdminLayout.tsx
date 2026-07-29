import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { getWhoAmI } from '../../api/user';
import { AdminBookings } from './AdminBookings';
import { AdminServices } from './AdminServices';

export function AdminLayout() {
  const { data: me, isLoading } = useQuery({ queryKey: ['whoami'], queryFn: getWhoAmI });
  const [tab, setTab] = useState<'bookings' | 'services'>('bookings');

  if (isLoading) return <p>Загрузка...</p>;
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
