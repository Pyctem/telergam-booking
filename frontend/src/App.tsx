import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ServicesList } from './pages/ServicesList/ServicesList';
import { SelectSlot } from './pages/BookingFlow/SelectSlot';
import { Confirm } from './pages/BookingFlow/Confirm';
import { MyBookings } from './pages/MyBookings/MyBookings';
import { useTelegramTheme } from './hooks/useTelegramTheme';

const queryClient = new QueryClient();

export function App() {
  useTelegramTheme();
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/" element={<ServicesList />} />
          <Route path="/booking/:serviceId" element={<SelectSlot />} />
          <Route path="/booking/:serviceId/confirm" element={<Confirm />} />
          <Route path="/my-bookings" element={<MyBookings />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
