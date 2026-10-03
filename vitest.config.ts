import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/test/**/*.test.ts', 'tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
