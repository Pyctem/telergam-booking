import { useEffect } from 'react';
import { bindThemeParamsCssVars } from '@telegram-apps/sdk-react';
import { ensureThemeParamsMounted } from '../lib/telegramTheme';

export function useTelegramTheme(): void {
  useEffect(() => {
    ensureThemeParamsMounted();
    if (bindThemeParamsCssVars.isAvailable()) {
      return bindThemeParamsCssVars();
    }
  }, []);
}
