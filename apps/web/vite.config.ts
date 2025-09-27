import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import topLevelAwait from "vite-plugin-top-level-await";
import wasm from "vite-plugin-wasm";

const workspaceRoot = path.resolve(__dirname, "..", "..");
const loaderDist = path.resolve(workspaceRoot, "packages/engine-loader/dist/index.js");
const wasmDist = path.resolve(workspaceRoot, "packages/engine-wasm/dist/index.js");

export default defineConfig({
  plugins: [react(), wasm(), topLevelAwait()],
  resolve: {
    alias: {
      "@": "/src",
      "@dcf-builder/engine-loader": loaderDist,
      "@dcf-builder/engine-wasm": wasmDist,
    },
  },
  optimizeDeps: {
    exclude: ["@dcf-builder/engine-loader", "@dcf-builder/engine-wasm"],
  },
  server: {
    fs: {
      allow: [workspaceRoot],
    },
  },
  build: {
    target: "es2021",
    rollupOptions: {
      external: ["parquet-wasm"],
    },
  },
});
