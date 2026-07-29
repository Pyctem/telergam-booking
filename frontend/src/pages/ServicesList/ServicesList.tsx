import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getServices } from '../../api/services';

export function ServicesList() {
  const { data: services, isLoading, error } = useQuery({ queryKey: ['services'], queryFn: getServices });

  if (isLoading) return <p>Загрузка...</p>;
  if (error) return <p>Не удалось загрузить услуги</p>;

  return (
    <div>
      <h1>Услуги</h1>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {services!.map((service) => (
          <li key={service.id}>
            <Link to={`/booking/${service.id}`}>
              <div style={{ background: 'var(--tg-theme-secondary-bg-color)', padding: 12, borderRadius: 8, marginBottom: 8 }}>
                <div>{service.name}</div>
                <div>{service.price} ₽ · {service.durationMinutes} мин</div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <Link to="/my-bookings">Мои записи</Link>
    </div>
  );
}
