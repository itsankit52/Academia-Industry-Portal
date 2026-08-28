import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Integration specs (/*.spec.ts) hit the same MongoDB database and cannot
    // run in parallel without corrupting each other's state. Run every file
    // sequentially so that `beforeEach(clearTestDb())` is safe.
    fileParallelism: false,
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    setupFiles: ['src/__tests__/setup.ts'],
    globalSetup: ['src/__tests__/globalSetup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/__tests__/**',
        'src/scripts/**',
        'src/seedData/**',
      ],
    },
  },
});
