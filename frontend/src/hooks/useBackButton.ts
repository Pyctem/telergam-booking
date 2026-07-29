import { useEffect } from 'react';
import { backButton } from '@telegram-apps/sdk-react';

export function useBackButton(onClick: () => void): void {
  useEffect(() => {
    if (backButton.mount.isAvailable() && !backButton.isMounted()) {
      backButton.mount();
    }
    if (backButton.show.isAvailable()) {
      backButton.show();
    }
    if (backButton.onClick.isAvailable()) {
      backButton.onClick(onClick);
    }
    return () => {
      if (backButton.offClick.isAvailable()) {
        backButton.offClick(onClick);
      }
      if (backButton.hide.isAvailable()) {
        backButton.hide();
      }
    };
  }, [onClick]);
}
