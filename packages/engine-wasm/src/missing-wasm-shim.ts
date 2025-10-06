import type { ValuationEngine } from "@dcf-builder/engine-contract";

export type WasmModuleSource = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface WasmEngineOptions {
  wasmModule?: WasmModuleSource;
}

const missingMessage = "WASM bindings are unavailable. Run pnpm --filter @dcf-builder/engine-wasm build to generate them.";

export async function createWasmEngine(): Promise<ValuationEngine> {
  return await Promise.reject<ValuationEngine>(new Error(missingMessage));
}

export async function preloadWasm(): Promise<void> {
  return await Promise.reject<void>(new Error(missingMessage));
}
