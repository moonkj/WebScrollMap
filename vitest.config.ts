import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.test.ts'],
    globals: true,
    coverage: {
      reporter: ['text', 'html'],
      include: ['src/core/**', 'src/ui/**', 'src/platform/**'],
    },
  },
  resolve: {
    alias: {
      '@core': resolve(__dirname, 'src/core'),
      '@content': resolve(__dirname, 'src/content'),
      '@ui': resolve(__dirname, 'src/ui'),
      '@platform': resolve(__dirname, 'src/platform'),
      '@config': resolve(__dirname, 'src/config'),
      '@test': resolve(__dirname, 'src/test'),
    },
  },
});
