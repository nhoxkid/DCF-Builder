import type {
  DcfInput,
  DcfOutput,
  ValuationEngine,
} from '@dcf-builder/engine-contract';
import { normalizeInput, validateInput } from '@dcf-builder/engine-contract';

export type WasmModuleSource = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

let defaultBindingsPromise: Promise<WasmBindings> | null = null;

export interface WasmEngineOptions {
  wasmModule?: WasmModuleSource;
}

export async function createWasmEngine(options?: WasmEngineOptions): Promise<ValuationEngine> {
  const bindings = await loadBindings(options?.wasmModule);
  const instance = new bindings.WasmDcfEngine();

  return {
    async npv(input: DcfInput): Promise<DcfOutput> {
      validateInput(input);
      const normalized = normalizeInput(input);
      const result = instance.npv(normalized);
      return result as DcfOutput;
    },
    async irr(input: DcfInput): Promise<number> {
      validateInput(input);
      const normalized = normalizeInput(input);
      return instance.irr(normalized);
    },
  };
}

export async function preloadWasm(module?: WasmModuleSource): Promise<void> {
  await loadBindings(module);
}

async function loadBindings(module?: WasmModuleSource): Promise<WasmBindings> {
  if (module) {
    const wasm = await import('../pkg/dcf.js');
    await wasm.default(module);
    return wasm;
  }

  if (!defaultBindingsPromise) {
    defaultBindingsPromise = (async () => {
      const wasm = await import('../pkg/dcf.js');
      await wasm.default();
      return wasm;
    })();
  }

  return defaultBindingsPromise;
}

type WasmBindings = typeof import('../pkg/dcf.js');
