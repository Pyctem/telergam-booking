import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { useTelegramTheme } from '../../src/hooks/useTelegramTheme';

const {
  mountThemeParamsSync,
  isThemeParamsMounted,
  bindThemeParamsCssVars,
  cleanup,
} = vi.hoisted(() => {
  const mountThemeParamsSync = Object.assign(vi.fn(), {
    isAvailable: vi.fn(),
  });
  const isThemeParamsMounted = vi.fn();
  const cleanup = vi.fn();
  const bindThemeParamsCssVars = Object.assign(vi.fn(), {
    isAvailable: vi.fn(),
  });
  return { mountThemeParamsSync, isThemeParamsMounted, bindThemeParamsCssVars, cleanup };
});

vi.mock('@telegram-apps/sdk-react', () => ({
  mountThemeParamsSync,
  isThemeParamsMounted,
  bindThemeParamsCssVars,
}));

function TestComponent() {
  useTelegramTheme();
  return null;
}

beforeEach(() => {
  vi.clearAllMocks();

  mountThemeParamsSync.isAvailable.mockReturnValue(true);
  bindThemeParamsCssVars.isAvailable.mockReturnValue(true);
  isThemeParamsMounted.mockReturnValue(false);
  bindThemeParamsCssVars.mockImplementation(() => cleanup);
});

describe('useTelegramTheme', () => {
  it('mounts the theme params component and binds CSS vars when available and not yet mounted', () => {
    render(<TestComponent />);

    expect(mountThemeParamsSync).toHaveBeenCalledTimes(1);
    expect(bindThemeParamsCssVars).toHaveBeenCalledTimes(1);
  });

  it('does not double-mount when the theme params component is already mounted, but still binds CSS vars', () => {
    isThemeParamsMounted.mockReturnValue(true);

    render(<TestComponent />);

    expect(mountThemeParamsSync).not.toHaveBeenCalled();
    expect(bindThemeParamsCssVars).toHaveBeenCalledTimes(1);
  });

  it('is a no-op outside a real Telegram environment (both isAvailable() return false)', () => {
    mountThemeParamsSync.isAvailable.mockReturnValue(false);
    bindThemeParamsCssVars.isAvailable.mockReturnValue(false);

    expect(() => render(<TestComponent />)).not.toThrow();

    expect(mountThemeParamsSync).not.toHaveBeenCalled();
    expect(bindThemeParamsCssVars).not.toHaveBeenCalled();
  });

  it('calls the cleanup function returned by bindThemeParamsCssVars on unmount', () => {
    const { unmount } = render(<TestComponent />);

    expect(cleanup).not.toHaveBeenCalled();

    unmount();

    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});
