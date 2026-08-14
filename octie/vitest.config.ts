import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Fast-fail the CLI's cache-invalidation probe so execSync-based tests
    // stay deterministic even when a stale `octie serve` answers on 3456.
    env: {
      OCTIE_CACHE_INVALIDATE_TIMEOUT_MS: '50',
    },
    include: ['**/*.{test,spec}.{js,ts}', 'src/**/*.{test,spec}.{js,ts}', 'test/**/*.{test,spec}.{js,ts}', 'tests/**/*.{test,spec}.{js,ts}'],
    exclude: ['node_modules', 'dist', 'web-ui/node_modules'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.spec.ts', 'src/types/**/*', 'dist/**/*', 'node_modules/**/*'],
      all: true,
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
        perFile: false,
        autoUpdate: true
      }
    },
    testTimeout: 30000,
    hookTimeout: 30000,
    teardownTimeout: 30000,
    reporters: ['default', 'html'],
    watch: false,
    // Benchmark configuration
    benchmark: {
      include: ['tests/benchmark/**/*.bench.ts'],
      exclude: ['node_modules', 'dist', 'web-ui/node_modules'],
      reporters: ['default'],
    }
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  }
})