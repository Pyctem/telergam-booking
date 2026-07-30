import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
    <div>
      <h2>Services</h2>
      <ul>
        {services?.map((service) => (
          <li key={service.id}>
            <span>{service.name}</span> — {service.price} ₽, {service.durationMinutes} min
            {service.isActive && <button onClick={() => deleteMutation.mutate(service.id)}>Delete</button>}
          </li>
        ))}
      </ul>
      <form onSubmit={handleSubmit}>
        <label htmlFor="service-name">Name</label>
        <input id="service-name" value={name} onChange={(e) => setName(e.target.value)} />
        <label htmlFor="service-price">Price</label>
        <input id="service-price" type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
        <label htmlFor="service-duration">Duration</label>
        <input
          id="service-duration"
          type="number"
          value={durationMinutes}
          onChange={(e) => setDurationMinutes(e.target.value)}
        />
        <button type="submit">Add</button>
      </form>
    </div>
  );
}
