import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import topLevelAwait from 'vite-plugin-top-level-await';
import wasm from 'vite-plugin-wasm';

const rootDir = path.resolve(__dirname, '..');

export default defineConfig({
  plugins: [react(), wasm(), topLevelAwait()],
  resolve: {
    alias: {
      '@': '/src',
      '@dcf-builder/engine-loader': path.resolve(rootDir, 'packages/engine-loader/src'),
      '@dcf-builder/engine-wasm': path.resolve(rootDir, 'packages/engine-wasm/src'),
    },
  },
  optimizeDeps: {
    exclude: ['@dcf-builder/engine-wasm', '@dcf-builder/engine-loader'],
  },
  server: {
    fs: {
      allow: [rootDir],
    },
  },
  build: {
    target: 'es2021',
    rollupOptions: {
      external: ['parquet-wasm'],
    },
  },
});
