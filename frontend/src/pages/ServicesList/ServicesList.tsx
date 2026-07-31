import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { List, Section, Cell, Placeholder } from '@telegram-apps/telegram-ui';
import { getServices } from '../../api/services';
import { formatDuration } from '../../lib/duration';
import { SkeletonRows } from '../../components/SkeletonRows';

function MyBookingsLink() {
  return (
    <Section>
      <Link to="/my-bookings" style={{ textDecoration: 'none', color: 'inherit' }}>
        <Cell>My Bookings</Cell>
      </Link>
    </Section>
  );
}

export function ServicesList() {
  const { data: services, isPending, error } = useQuery({ queryKey: ['services'], queryFn: getServices });

  // isPending (not isLoading) is the correct "no data yet" check in React Query v5:
  // isLoading is isPending && isFetching, so it drops to false during a failed
  // query's retry-backoff delay even though there's still no data — services!
  // would then crash. isPending stays true for that whole window.
  if (isPending) {
    return (
      <List>
        <Section header="Services">
          <SkeletonRows label="Loading services" />
        </Section>
        <MyBookingsLink />
      </List>
    );
  }
  if (error) {
    return <Placeholder header="Failed to load services" />;
  }

  return (
    <List>
      <Section header="Services">
        {services.map((service) => (
          <Link
            key={service.id}
            to={`/booking/${service.id}`}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <Cell subtitle={`${service.price} ₽ · ${formatDuration(service.durationMinutes)}`}>{service.name}</Cell>
          </Link>
        ))}
      </Section>
      <MyBookingsLink />
    </List>
  );
}
