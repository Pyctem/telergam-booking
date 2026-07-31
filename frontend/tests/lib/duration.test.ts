import { describe, it, expect } from 'vitest';
import { formatDuration } from '../../src/lib/duration';

describe('formatDuration', () => {
  it('shows minutes only when under an hour', () => {
    expect(formatDuration(30)).toBe('30 min');
  });

  it('shows hours only on an exact hour', () => {
    expect(formatDuration(60)).toBe('1h');
  });

  it('shows hours and minutes together otherwise', () => {
    expect(formatDuration(90)).toBe('1h 30min');
  });

  it('handles multiple hours', () => {
    expect(formatDuration(150)).toBe('2h 30min');
  });
});
