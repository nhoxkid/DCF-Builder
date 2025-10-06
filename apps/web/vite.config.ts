import fs from "node:fs";
import path from "node:path";

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import topLevelAwait from "vite-plugin-top-level-await";
import wasm from "vite-plugin-wasm";

const workspaceRoot = path.resolve(__dirname, "..", "..");
const loaderDist = path.resolve(workspaceRoot, "packages/engine-loader/dist/index.js");
const wasmDist = path.resolve(workspaceRoot, "packages/engine-wasm/dist/index.js");
const loaderSrc = path.resolve(workspaceRoot, "packages/engine-loader/src/index.ts");
const wasmSrc = path.resolve(workspaceRoot, "packages/engine-wasm/src/index.ts");
const wasmPkg = path.resolve(workspaceRoot, "packages/engine-wasm/pkg/dcf.js");
const wasmShim = path.resolve(workspaceRoot, "packages/engine-wasm/src/missing-wasm-shim.ts");

const loaderEntry = fs.existsSync(loaderDist) ? loaderDist : loaderSrc;
const wasmEntry = fs.existsSync(wasmDist)
  ? wasmDist
  : fs.existsSync(wasmPkg)
    ? wasmSrc
    : wasmShim;

export default defineConfig({
  plugins: [react(), wasm(), topLevelAwait()],
  resolve: {
    alias: {
      "@": "/src",
      "@dcf-builder/engine-loader": loaderEntry,
      "@dcf-builder/engine-wasm": wasmEntry,
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
