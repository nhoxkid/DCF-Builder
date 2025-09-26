import { useEffect, useState } from 'react';
import { loadValuationEngine, type EngineKind } from '@dcf-builder/engine-loader';
import type { ValuationEngine } from '@dcf-builder/engine-contract';

export type EngineState =
  | { status: 'loading' }
  | { status: 'ready'; engine: ValuationEngine; kind: EngineKind }
  | { status: 'error'; error: Error };

export function useValuationEngine(): EngineState {
  const [state, setState] = useState<EngineState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    loadValuationEngine()
      .then((result) => {
        if (!cancelled) {
          setState({ status: 'ready', engine: result.engine, kind: result.kind });
        }
      })
      .catch((error) => {
        const fallbackMessage =
          error instanceof Error ? error : new Error('Unable to load valuation engine');
        if (!cancelled) {
          setState({ status: 'error', error: fallbackMessage });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
