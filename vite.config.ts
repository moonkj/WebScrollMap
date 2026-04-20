import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig(({ mode }) => ({
  build: {
    outDir: 'extension/dist',
    emptyOutDir: true,
    sourcemap: mode === 'development',
    lib: {
      entry: resolve(__dirname, 'src/content/entry.ts'),
      formats: ['iife'],
      name: 'WebScrollMap',
      fileName: () => 'content.js',
    },
    rollupOptions: {
      output: { extend: true },
    },
    target: 'es2022',
    minify: mode !== 'development',
  },
  esbuild: {
    drop: mode === 'development' ? [] : ['console', 'debugger'],
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
}));
