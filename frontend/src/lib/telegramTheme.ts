import { mountThemeParamsSync, isThemeParamsMounted } from '@telegram-apps/sdk-react';

// Guarded, idempotent mount — safe to call multiple times (e.g. once
// synchronously in main.tsx before the first render, and again from
// useTelegramTheme's effect). Outside a real Telegram client,
// mountThemeParamsSync.isAvailable() is false and this is a no-op.
export function ensureThemeParamsMounted(): void {
  if (mountThemeParamsSync.isAvailable() && !isThemeParamsMounted()) {
    mountThemeParamsSync();
  }
}
