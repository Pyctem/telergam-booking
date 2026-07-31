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
      {/* "All Services", not "Services" — AdminLayout's Tabbar item for this
          tab is labeled "Services", and having this Section header duplicate
          it breaks getByText's uniqueness assumption for any test that
          switches to this tab (same reasoning as the Bookings tab rename in
          AdminLayout). */}
      <Section header="All Services">
        {services?.map((service) => (
          <Cell
            key={service.id}
            subtitle={`${service.price} ₽ · ${service.durationMinutes} min`}
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
