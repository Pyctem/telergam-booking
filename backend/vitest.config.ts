import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    hookTimeout: 20000,
    // Test files share one live Postgres DB and tests/setup.ts truncates
    // tables in a beforeEach. Running files in parallel lets one file's
    // truncate wipe rows another file is mid-transaction with, so force
    // sequential file execution.
    fileParallelism: false,
  },
});
