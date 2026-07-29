import { useEffect } from 'react';
import {
  bindThemeParamsCssVars,
  mountThemeParamsSync,
  isThemeParamsMounted,
} from '@telegram-apps/sdk-react';

export function useTelegramTheme(): void {
  useEffect(() => {
    if (mountThemeParamsSync.isAvailable() && !isThemeParamsMounted()) {
      mountThemeParamsSync();
    }
    if (bindThemeParamsCssVars.isAvailable()) {
      return bindThemeParamsCssVars();
    }
  }, []);
}
