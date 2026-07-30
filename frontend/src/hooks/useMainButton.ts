import { useEffect } from 'react';
import { mainButton } from '@telegram-apps/sdk-react';

export function useMainButton(options: {
  text: string;
  onClick: () => void;
  enabled: boolean;
  loading?: boolean;
}): void {
  useEffect(() => {
    if (mainButton.mount.isAvailable() && !mainButton.isMounted()) {
      mainButton.mount();
    }
    if (mainButton.setParams.isAvailable()) {
      mainButton.setParams({
        text: options.text,
        // Disabled while loading too, so a second tap can't fire a second
        // request while the first one is still in flight — the enabled prop
        // alone (e.g. "is there a service to book") doesn't know about that.
        isEnabled: options.enabled && !options.loading,
        isLoaderVisible: Boolean(options.loading),
        isVisible: true,
      });
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
  }, [options.text, options.onClick, options.enabled, options.loading]);
}
