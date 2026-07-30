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
          <Link
            key={service.id}
            to={`/booking/${service.id}`}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <Cell subtitle={`${service.price} ₽ · ${service.durationMinutes} мин`}>{service.name}</Cell>
          </Link>
        ))}
      </Section>
      <Section>
        <Link to="/my-bookings" style={{ textDecoration: 'none', color: 'inherit' }}>
          <Cell>Мои записи</Cell>
        </Link>
      </Section>
    </List>
  );
}
