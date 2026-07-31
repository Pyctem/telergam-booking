import { Cell, Skeleton } from '@telegram-apps/telegram-ui';

interface SkeletonRowsProps {
  count?: number;
  label: string;
}

// A fixed row count, not derived from real data (which isn't known yet
// during the loading state) — enough to fill a typical list without
// reserving obviously excessive empty space. `role="status"`/aria-label
// goes on the wrapper, not per row, so screen readers announce the loading
// state once instead of repeating it for every skeleton row.
export function SkeletonRows({ count = 3, label }: SkeletonRowsProps) {
  return (
    <div role="status" aria-label={label}>
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} visible>
          <Cell subtitle="Loading">Loading</Cell>
        </Skeleton>
      ))}
    </div>
  );
}
