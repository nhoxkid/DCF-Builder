import type {
  DcfInput,
  DcfOutput,
  ValuationEngine,
} from "@dcf-builder/engine-contract";
import { normalizeInput, validateInput } from "@dcf-builder/engine-contract";

export type WasmModuleSource = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

type WasmBindings = {
  default(module?: WasmModuleSource): Promise<unknown>;
  WasmDcfEngine: new () => {
    npv(input: DcfInput): DcfOutput;
    irr(input: DcfInput): number;
  };
};

let defaultBindingsPromise: Promise<WasmBindings> | null = null;

export interface WasmEngineOptions {
  wasmModule?: WasmModuleSource;
}

export async function createWasmEngine(options?: WasmEngineOptions): Promise<ValuationEngine> {
  const bindings = await loadBindings(options?.wasmModule);
  const instance = new bindings.WasmDcfEngine();

  return {
    npv(input: DcfInput): Promise<DcfOutput> {
      validateInput(input);
      const normalized = normalizeInput(input);
      const result = instance.npv(normalized) as DcfOutput;
      return Promise.resolve(result);
    },
    irr(input: DcfInput): Promise<number> {
      validateInput(input);
      const normalized = normalizeInput(input);
      const result = instance.irr(normalized);
      if (typeof result !== "number" || Number.isNaN(result)) {
        return Promise.reject(new Error("IRR not found"));
      }
      return Promise.resolve(result);
    },
  };
}

export async function preloadWasm(module?: WasmModuleSource): Promise<void> {
  await loadBindings(module);
}

async function loadBindings(module?: WasmModuleSource): Promise<WasmBindings> {
  if (module) {
    const wasm = (await import("../pkg/dcf.js")) as WasmBindings;
    await wasm.default(module);
    return wasm;
  }

  if (!defaultBindingsPromise) {
    defaultBindingsPromise = (async () => {
      const wasm = (await import("../pkg/dcf.js")) as WasmBindings;
      await wasm.default();
      return wasm;
    })();
  }

  return defaultBindingsPromise;
}

