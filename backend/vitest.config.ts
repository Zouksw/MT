import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/**/__tests__/**', 'src/test-helpers.ts', 'src/test-setup.ts'],
      thresholds: {
        branches: 50,
        functions: 50,
        lines: 50,
        statements: 50,
      },
    },
    alias: { '@': resolve(__dirname, './src') },
    setupFiles: ['./src/test-setup.ts'],
    testTimeout: 30000,
  },
});
