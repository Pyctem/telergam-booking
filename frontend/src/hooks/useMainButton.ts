import { useEffect } from 'react';
import { mainButton } from '@telegram-apps/sdk-react';

export function useMainButton(options: { text: string; onClick: () => void; enabled: boolean }): void {
  useEffect(() => {
    if (mainButton.mount.isAvailable() && !mainButton.isMounted()) {
      mainButton.mount();
    }
    if (mainButton.setParams.isAvailable()) {
      mainButton.setParams({ text: options.text, isEnabled: options.enabled, isVisible: true });
    }
    if (mainButton.onClick.isAvailable()) {
      mainButton.onClick(options.onClick);
    }
    return () => {
      if (mainButton.offClick.isAvailable()) {
        mainButton.offClick(options.onClick);
      }
      if (mainButton.setParams.isAvailable()) {
        mainButton.setParams({ isVisible: false });
      }
    };
  }, [options.text, options.onClick, options.enabled]);
}
