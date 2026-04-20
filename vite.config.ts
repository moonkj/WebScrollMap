import { defineConfig } from 'vite';
import { resolve } from 'node:path';

type EntryName = 'content' | 'background' | 'popup';

const entries: Record<EntryName, string> = {
  content: 'src/content/entry.ts',
  background: 'src/background/entry.ts',
  popup: 'src/popup/entry.ts',
};

export default defineConfig(({ mode }) => {
  const entry = (process.env.ENTRY ?? 'content') as EntryName;
  if (!(entry in entries)) {
    throw new Error(`Unknown ENTRY="${entry}". Use one of: ${Object.keys(entries).join(', ')}`);
  }
  return {
    build: {
      outDir: 'extension/dist',
      emptyOutDir: entry === 'content', // 첫 빌드에서만 비움
      sourcemap: mode === 'development',
      target: 'es2022',
      minify: mode !== 'development',
      lib: {
        entry: resolve(__dirname, entries[entry]),
        formats: ['iife'],
        name: `WebScrollMap_${entry}`,
        fileName: () => `${entry}.js`,
      },
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
  };
});
