import { useQuery } from '@tanstack/react-query';
import { getSettings } from '../api/settings';

// Thin wrapper so every page that needs the business's timezone/booking
// horizon shares one cached query instead of re-declaring it.
//
// Deliberately returns the raw query result (data/isPending/isError, ...)
// rather than unwrapping it with a hardcoded fallback (e.g. defaulting to
// 'UTC' or 14 days while loading). Silently defaulting during the loading
// window would just reintroduce a milder version of the bug this hook
// exists to fix: the UI would briefly show times/dates computed against the
// wrong timezone, which looks plausible enough that nobody would notice.
// Callers should branch on `isPending` and render a short "Загрузка..."
// state instead.
export function useBusinessSettings() {
  return useQuery({ queryKey: ['settings'], queryFn: getSettings });
}
