import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTelegramTheme } from '../../src/hooks/useTelegramTheme';

vi.mock('@telegram-apps/sdk-react', () => ({
  useSignal: vi.fn(),
  themeParams: {
    state: () => ({
      bgColor: '#111111',
      textColor: '#eeeeee',
      buttonColor: '#2481cc',
      buttonTextColor: '#ffffff',
    }),
  },
}));

beforeEach(() => {
  document.documentElement.removeAttribute('style');
});

describe('useTelegramTheme', () => {
  it('applies Telegram theme params as CSS custom properties on the document root', async () => {
    const { useSignal } = await import('@telegram-apps/sdk-react');
    (useSignal as ReturnType<typeof vi.fn>).mockReturnValue({
      bgColor: '#111111',
      textColor: '#eeeeee',
      buttonColor: '#2481cc',
      buttonTextColor: '#ffffff',
    });

    renderHook(() => useTelegramTheme());

    expect(document.documentElement.style.getPropertyValue('--tg-theme-bg-color')).toBe('#111111');
    expect(document.documentElement.style.getPropertyValue('--tg-theme-text-color')).toBe('#eeeeee');
    expect(document.documentElement.style.getPropertyValue('--tg-theme-button-color')).toBe('#2481cc');
  });
});
