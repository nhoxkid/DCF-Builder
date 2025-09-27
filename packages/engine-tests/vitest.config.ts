import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packagesRoot = path.resolve(__dirname, "..");

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@dcf-builder/engine-contract": path.resolve(packagesRoot, "engine-contract/src/index.ts"),
      "@dcf-builder/engine-ts": path.resolve(packagesRoot, "engine-ts/src/index.ts"),
      "@dcf-builder/engine-wasm": path.resolve(packagesRoot, "engine-wasm/src/index.ts"),
    },
  },
});

