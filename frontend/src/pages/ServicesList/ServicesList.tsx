import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getServices } from '../../api/services';

export function ServicesList() {
  const { data: services, isPending, error } = useQuery({ queryKey: ['services'], queryFn: getServices });

  // isPending (not isLoading) is the correct "no data yet" check in React Query v5:
  // isLoading is isPending && isFetching, so it drops to false during a failed
  // query's retry-backoff delay even though there's still no data — services!
  // would then crash. isPending stays true for that whole window.
  if (isPending) return <p>Загрузка...</p>;
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
