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
      <h2>Услуги</h2>
      <ul>
        {services?.map((service) => (
          <li key={service.id}>
            <span>{service.name}</span> — {service.price} ₽, {service.durationMinutes} мин
            {service.isActive && <button onClick={() => deleteMutation.mutate(service.id)}>Удалить</button>}
          </li>
        ))}
      </ul>
      <form onSubmit={handleSubmit}>
        <label htmlFor="service-name">Название</label>
        <input id="service-name" value={name} onChange={(e) => setName(e.target.value)} />
        <label htmlFor="service-price">Цена</label>
        <input id="service-price" type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
        <label htmlFor="service-duration">Длительность</label>
        <input
          id="service-duration"
          type="number"
          value={durationMinutes}
          onChange={(e) => setDurationMinutes(e.target.value)}
        />
        <button type="submit">Добавить</button>
      </form>
    </div>
  );
}
