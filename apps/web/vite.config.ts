import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import topLevelAwait from 'vite-plugin-top-level-await';
import wasm from 'vite-plugin-wasm';

export default defineConfig({
  plugins: [react(), wasm(), topLevelAwait()],
  resolve: {
    alias: {
      '@': '/src',
      '@dcf-builder/engine-wasm': path.resolve(__dirname, '../packages/engine-wasm/dist/index.js'),
    },
  },
  optimizeDeps: {
    exclude: ['@dcf-builder/engine-wasm'],
  },
  build: {
    target: 'es2021',
    rollupOptions: {
      external: ['parquet-wasm', '@dcf-builder/engine-wasm'],
    },
  },
});
