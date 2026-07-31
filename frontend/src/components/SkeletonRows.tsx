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
    <div role="status" aria-label={label} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 8 }}>
      {Array.from({ length: count }, (_, index) => (
        // These rows aren't Section's direct children (this whole group is
        // one child), so Section's automatic divider-between-children never
        // kicks in between them — without an explicit gap and rounded
        // corners here, three edge-to-edge skeletons in the same shimmer
        // color just fused into a single solid block with no visible seams.
        <Skeleton key={index} visible style={{ borderRadius: 12, overflow: 'hidden' }}>
          <Cell subtitle="Loading">Loading</Cell>
        </Skeleton>
      ))}
    </div>
  );
}
