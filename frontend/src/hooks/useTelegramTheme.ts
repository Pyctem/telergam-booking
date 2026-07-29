import { useEffect } from 'react';
import { themeParams, useSignal } from '@telegram-apps/sdk-react';

const CSS_VAR_MAP: Record<string, string> = {
  bgColor: '--tg-theme-bg-color',
  textColor: '--tg-theme-text-color',
  hintColor: '--tg-theme-hint-color',
  linkColor: '--tg-theme-link-color',
  buttonColor: '--tg-theme-button-color',
  buttonTextColor: '--tg-theme-button-text-color',
  secondaryBgColor: '--tg-theme-secondary-bg-color',
};

export function useTelegramTheme(): void {
  const theme = useSignal(themeParams.state);

  useEffect(() => {
    if (!theme) return;
    for (const [key, cssVar] of Object.entries(CSS_VAR_MAP)) {
      const value = (theme as Record<string, string | undefined>)[key];
      if (value) {
        document.documentElement.style.setProperty(cssVar, value);
      }
    }
  }, [theme]);
}
