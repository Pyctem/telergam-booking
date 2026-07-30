import { useSignal, themeParams } from '@telegram-apps/sdk-react';

export function useTelegramAppearance(): 'light' | 'dark' {
  const isDark = useSignal(themeParams.isDark);
  return isDark ? 'dark' : 'light';
}
