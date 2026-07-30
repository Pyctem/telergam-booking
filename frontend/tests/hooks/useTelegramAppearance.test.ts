import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTelegramAppearance } from '../../src/hooks/useTelegramAppearance';

vi.mock('@telegram-apps/sdk-react', () => ({
  useSignal: vi.fn(),
  themeParams: { isDark: vi.fn() },
}));

describe('useTelegramAppearance', () => {
  it('returns "dark" when the isDark signal is true', async () => {
    const { useSignal } = await import('@telegram-apps/sdk-react');
    (useSignal as ReturnType<typeof vi.fn>).mockReturnValue(true);

    const { result } = renderHook(() => useTelegramAppearance());

    expect(result.current).toBe('dark');
  });

  it('returns "light" when the isDark signal is false', async () => {
    const { useSignal } = await import('@telegram-apps/sdk-react');
    (useSignal as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const { result } = renderHook(() => useTelegramAppearance());

    expect(result.current).toBe('light');
  });
});
