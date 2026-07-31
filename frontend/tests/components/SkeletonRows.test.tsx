import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { SkeletonRows } from '../../src/components/SkeletonRows';
import { renderWithProviders } from '../testUtils';

describe('SkeletonRows', () => {
  it('renders a single accessible status region with the given label', () => {
    renderWithProviders(<SkeletonRows label="Loading things" />);

    expect(screen.getByRole('status', { name: 'Loading things' })).toBeInTheDocument();
  });

  it('defaults to 3 rows', () => {
    const { container } = renderWithProviders(<SkeletonRows label="Loading things" />);
    expect(container.querySelectorAll('[role="status"] > *')).toHaveLength(3);
  });

  it('respects a custom count', () => {
    const { container } = renderWithProviders(<SkeletonRows label="Loading things" count={5} />);
    expect(container.querySelectorAll('[role="status"] > *')).toHaveLength(5);
  });
});
