import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    // Agent worktrees live under .claude/; never run their copies of the tests.
    // Browser tests (e2e/) run with Playwright: npm run e2e.
    exclude: [...configDefaults.exclude, '.claude/**', 'e2e/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      'server-only': path.resolve(__dirname, 'tests/server-only.ts'),
    },
  },
});
