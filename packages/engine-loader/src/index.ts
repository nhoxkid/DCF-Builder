import type { ValuationEngine } from '@dcf-builder/engine-contract';
import { createTsEngine } from '@dcf-builder/engine-ts';
import { createWasmEngine, type WasmEngineOptions } from '@dcf-builder/engine-wasm';

export type EngineKind = 'wasm' | 'ts';

export interface EngineLoadResult {
  engine: ValuationEngine;
  kind: EngineKind;
}

export interface LoadOptions extends WasmEngineOptions {
  preferred?: EngineKind;
  allowTsFallback?: boolean;
}

export async function loadValuationEngine(options: LoadOptions = {}): Promise<EngineLoadResult> {
  const preferred: EngineKind = options.preferred ?? 'wasm';
  const allowFallback = options.allowTsFallback ?? true;

  const attempts: EngineKind[] = preferred === 'wasm' ? ['wasm', 'ts'] : ['ts', 'wasm'];

  for (const kind of attempts) {
    try {
      if (kind === 'wasm') {
        if (!isWasmSupported()) {
          throw new Error('WebAssembly not supported in this environment');
        }
        const engine = await createWasmEngine({ wasmModule: options.wasmModule });
        return { engine, kind };
      }

      if (kind === 'ts') {
        const engine = createTsEngine();
        return { engine, kind };
      }
    } catch (error) {
      if (kind === 'ts' || !allowFallback) {
        throw error;
      }
      // Otherwise try the next option
    }
  }

  throw new Error('Unable to load valuation engine');
}

export function isWasmSupported(): boolean {
  return typeof WebAssembly !== 'undefined' && typeof WebAssembly.instantiate === 'function';
}
