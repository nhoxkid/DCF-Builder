import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import topLevelAwait from 'vite-plugin-top-level-await';
import wasm from 'vite-plugin-wasm';

const workspaceRoot = path.resolve(__dirname, '..', '..');

export default defineConfig({
  plugins: [react(), wasm(), topLevelAwait()],
  resolve: {
    alias: {
      '@': '/src',
      '@dcf-builder/engine-loader': path.resolve(workspaceRoot, 'packages/engine-loader/src'),
      '@dcf-builder/engine-wasm': path.resolve(workspaceRoot, 'packages/engine-wasm/src'),
    },
  },
  optimizeDeps: {
    exclude: ['@dcf-builder/engine-loader', '@dcf-builder/engine-wasm'],
  },
  server: {
    fs: {
      allow: [workspaceRoot],
    },
  },
  build: {
    target: 'es2021',
    rollupOptions: {
      external: ['parquet-wasm'],
    },
  },
});
