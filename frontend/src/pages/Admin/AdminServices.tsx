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
      {/* <form> wraps the Section (not the other way around) so the three
          Inputs are Section's own direct children — Section inserts a
          visible Divider between direct children automatically, which is
          what actually separates the fields. When the inputs were nested
          inside a <form> that was Section's only child, Section saw one
          child and drew no dividers, and since Input's own background
          (--tgui--bg_color) is identical to Section's card background
          (--tgui--section_bg_color) by default, the three fields visually
          fused into one blank area on iOS. `placeholder` is also required
          on every field: `header` only renders on the `base` platform (see
          the Input usage note in AdminBookings.tsx), so iOS had no visible
          hint of what each blank field was for. */}
      <form onSubmit={handleSubmit}>
        <Section>
          <Input
            header="Name"
            placeholder="Name"
            aria-label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            header="Price"
            placeholder="Price"
            aria-label="Price"
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          <Input
            header="Duration"
            placeholder="Duration"
            aria-label="Duration"
            type="number"
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(e.target.value)}
          />
        </Section>
        <div style={{ padding: '12px 24px' }}>
          <Button type="submit" mode="filled" stretched>
            Add
          </Button>
        </div>
      </form>
    </List>
  );
}
